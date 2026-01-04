import Cerebras from '@cerebras/cerebras_cloud_sdk';
import type { 
    ChatCompletionCreateParamsStreaming,
    ChatCompletion 
} from '@cerebras/cerebras_cloud_sdk/resources/chat/completions';
import type { Stream } from '@cerebras/cerebras_cloud_sdk/streaming';
import type { AIService, ChatMessage } from '../types';

const cerebras = new Cerebras();

/**
 * Convierte mensajes genéricos a los tipos específicos de Cerebras
 */
function convertMessagesToCerebras(
    messages: ChatMessage[]
): ChatCompletionCreateParamsStreaming['messages'] {
    return messages.map((msg) => {
        if (msg.role === 'system') {
            return {
                role: 'system' as const,
                content: msg.content
            };
        } else if (msg.role === 'assistant') {
            return {
                role: 'assistant' as const,
                content: msg.content
            };
        } else {
            return {
                role: 'user' as const,
                content: msg.content
            };
        }
    });
}

export const cerebrasService: AIService = {
    name: "Cerebras",
    async chat(messages: ChatMessage[], model?: string) {
        const params: ChatCompletionCreateParamsStreaming = {
            messages: convertMessagesToCerebras(messages),
            model: model || 'qwen-3-32b',
            stream: true,
            max_completion_tokens: 16382,
            temperature: 0.6,
            top_p: 0.95,
            // Deshabilitar reasoning para que solo devuelva el mensaje final
            reasoning_format: 'hidden',
            disable_reasoning: true
        };
        
        const chatCompletion = await cerebras.chat.completions.create(params);
        
        return (async function* () {
            let accumulatedContent = '';
            let inReasoningBlock = false;
            
            for await (const chunk of chatCompletion) {
                // El tipo ChatCompletion puede ser ChatCompletionResponse, ChatChunkResponse o ErrorChunkResponse
                // Solo procesamos ChatChunkResponse que tiene choices con delta
                if ('choices' in chunk && Array.isArray(chunk.choices) && chunk.choices.length > 0) {
                    const choice = chunk.choices[0];
                    if (choice && 'delta' in choice && choice.delta) {
                        const delta = choice.delta;
                        
                        // Verificar si hay contenido de reasoning
                        if ('reasoning' in delta && delta.reasoning) {
                            // Ignorar el contenido de reasoning
                            continue;
                        }
                        
                        // Solo procesar contenido normal
                        if ('content' in delta && delta.content) {
                            const content = delta.content;
                            
                            // Filtrar bloques de reasoning que puedan venir en el contenido
                            // Patrones comunes: <think>, <thinking>, <reasoning>, etc.
                            let filteredContent = content;
                            
                            // Remover bloques de reasoning que empiecen con <think> o similares
                            if (filteredContent.includes('<think>') || 
                                filteredContent.includes('<thinking>') ||
                                filteredContent.includes('<reasoning>')) {
                                inReasoningBlock = true;
                                continue;
                            }
                            
                            // Si estamos en un bloque de reasoning, ignorar hasta encontrar el cierre
                            if (inReasoningBlock) {
                                if (filteredContent.includes('</think>') ||
                                    filteredContent.includes('</thinking>') ||
                                    filteredContent.includes('</reasoning>')) {
                                    inReasoningBlock = false;
                                    // Remover el tag de cierre y todo lo anterior
                                    filteredContent = filteredContent.replace(/.*<\/?(?:redacted_)?reasoning>/, '');
                                } else {
                                    continue;
                                }
                            }
                            
                            // Filtrar patrones de código que puedan ser reasoning
                            // Remover bloques que empiecen con @bash, @code, etc. seguidos de números
                            filteredContent = filteredContent.replace(/@\w+\s*\(\d+-\d+\)\s*/g, '');
                            
                            if (filteredContent.trim()) {
                                yield filteredContent;
                            }
                        }
                    }
                }
            }
        })()
    }
};