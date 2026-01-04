import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { groqService } from './services/groq';
import { cerebrasService } from './services/cerebras';
import type { AIService, ChatMessage } from './types';

const services: AIService[] = [
    groqService,
    cerebrasService
];

// Mapa de servicios por nombre (case-insensitive)
const servicesMap: Record<string, AIService> = {
    'groq': groqService,
    'cerebras': cerebrasService,
};

let currentServiceIndex = 0;

function getNextService(): AIService {
    if (services.length === 0) {
        throw new Error('No services available');
    }
    const service = services[currentServiceIndex];
    if (!service) {
        throw new Error('Service not found');
    }
    currentServiceIndex = (currentServiceIndex + 1) % services.length;
    return service;
}

function getServiceByName(serviceName: string | null): AIService | null {
    if (!serviceName) {
        return null;
    }
    const normalizedName = serviceName.toLowerCase().trim();
    return servicesMap[normalizedName] || null;
}

// API Key desde variable de entorno
const API_KEY = process.env.API_KEY || process.env.API_SECRET_KEY;

/**
 * Verifica la autenticación de la petición
 */
function verifyAuth(req: Request): boolean {
    if (!API_KEY) {
        // Si no hay API_KEY configurada, permitir acceso (modo desarrollo)
        return true;
    }

    // Verificar header Authorization: Bearer <token>
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        return token === API_KEY;
    }

    // Verificar header X-API-Key
    const apiKeyHeader = req.headers.get('X-API-Key');
    if (apiKeyHeader) {
        return apiKeyHeader === API_KEY;
    }

    return false;
}

const server = Bun.serve({
    port: process.env.PORT ??  4000,
    async fetch(req) {
        const {pathname} = new URL(req.url)
        
        if (req.method === 'GET' && pathname === '/') {
            const file = Bun.file('index.html');
            return new Response(file, {
                headers: {
                    'Content-Type': 'text/html',
                },
            });
        }
        
        if (req.method === 'POST' && pathname === '/chat') {
            // Verificar autenticación
            if (!verifyAuth(req)) {
                return new Response(
                    JSON.stringify({ error: 'Unauthorized. Please provide a valid API key.' }),
                    {
                        status: 401,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                    }
                );
            }

            // Leer headers de service y model (solo si tienen valor)
            const serviceHeaderRaw = req.headers.get('service') || req.headers.get('X-Service');
            const modelHeaderRaw = req.headers.get('model') || req.headers.get('X-Model');
            
            // Normalizar: tratar strings vacíos como null
            const serviceHeader = serviceHeaderRaw && serviceHeaderRaw.trim() ? serviceHeaderRaw.trim() : null;
            const modelHeader = modelHeaderRaw && modelHeaderRaw.trim() ? modelHeaderRaw.trim() : null;

            // Seleccionar servicio
            let service: AIService;
            if (serviceHeader) {
                const selectedService = getServiceByName(serviceHeader);
                if (!selectedService) {
                    return new Response(
                        JSON.stringify({ 
                            error: `Invalid service. Available services: ${Object.keys(servicesMap).join(', ')}` 
                        }),
                        {
                            status: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                        }
                    );
                }
                service = selectedService;
            } else {
                // Si no se especifica, usar round-robin
                service = getNextService();
            }

            const body = await req.json() as { messages: ChatMessage[]; language?: string };
            const { messages, language } = body;
            
            // Usar español por defecto si no se especifica idioma
            const targetLanguage = (language && language.trim()) || 'español';
            
            // Agregar instrucción de idioma (siempre, con español por defecto)
            let processedMessages = [...messages];
            const languageInstruction: ChatMessage = {
                role: 'system',
                content: `Responde siempre en ${targetLanguage}.`
            };
            // Insertar al inicio si no hay mensaje del sistema, o después del primer mensaje del sistema
            const firstSystemIndex = processedMessages.findIndex(msg => msg.role === 'system');
            if (firstSystemIndex >= 0) {
                // Si hay mensaje del sistema, combinarlo con la instrucción de idioma
                const existingSystemMessage = processedMessages[firstSystemIndex];
                if (existingSystemMessage) {
                    processedMessages[firstSystemIndex] = {
                        role: 'system',
                        content: `${existingSystemMessage.content}\n\nResponde siempre en ${targetLanguage}.`
                    };
                }
            } else {
                // Si no hay mensaje del sistema, agregarlo al inicio
                processedMessages = [languageInstruction, ...processedMessages];
            }
            
            console.log(`[${new Date().toISOString()}] Service: ${service.name}${serviceHeader ? ` (requested: ${serviceHeader})` : ' (round-robin)'}${modelHeader ? `, Model: ${modelHeader}` : ''}, Language: ${targetLanguage}${language ? '' : ' (default)'}`);
            
            try {
                const stream = await service.chat(processedMessages, modelHeader || undefined);
                return new Response(stream, {
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            } catch (error: any) {
                console.error(`[${new Date().toISOString()}] Error with ${service.name}:`, error);
                
                // Si el servicio fue especificado explícitamente, retornar el error
                if (serviceHeader) {
                    const errorMessage = error?.error?.message || error?.message || 'Service error';
                    const statusCode = error?.status || error?.statusCode || 500;
                    
                    return new Response(
                        JSON.stringify({ 
                            error: errorMessage,
                            service: service.name,
                            status: statusCode
                        }),
                        {
                            status: statusCode >= 400 && statusCode < 600 ? statusCode : 500,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                        }
                    );
                }
                
                // Si no se especificó servicio, intentar fallback con el otro servicio
                const fallbackService = service === groqService ? cerebrasService : groqService;
                console.log(`[${new Date().toISOString()}] Attempting fallback to ${fallbackService.name}`);
                
                try {
                    const stream = await fallbackService.chat(processedMessages, modelHeader || undefined);
                    return new Response(stream, {
                        headers: {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive',
                            'Access-Control-Allow-Origin': '*',
                        },
                    });
                } catch (fallbackError: any) {
                    // Si el fallback también falla, retornar error
                    const errorMessage = fallbackError?.error?.message || fallbackError?.message || 'All services failed';
                    const statusCode = fallbackError?.status || fallbackError?.statusCode || 500;
                    
                    return new Response(
                        JSON.stringify({ 
                            error: errorMessage,
                            services: [service.name, fallbackService.name],
                            status: statusCode
                        }),
                        {
                            status: statusCode >= 400 && statusCode < 600 ? statusCode : 500,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                        }
                    );
                }
            }
        }
        return new Response("Not found", { status: 404 });
    }
});

console.log(`Server is running on ${server.url}:${server.port}`);