# Instrucciones para Probar el API en Postman

## Configuración en Postman

### 1. Crear una nueva petición

1. Abre Postman
2. Clic en **"New"** → **"HTTP Request"**
3. Configura la petición:

### 2. Configuración de la petición

**Método:** `POST`

**URL:** `http://localhost:4000/chat`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer your-api-key-here
service: groq
model: moonshotai/kimi-k2-instruct-0905
```

**O alternativamente:**
```
Content-Type: application/json
X-API-Key: your-api-key-here
X-Service: cerebras
X-Model: qwen-3-32b
```

> **Nota sobre Autenticación:** Si el servidor tiene configurada una `API_KEY` en las variables de entorno, debes incluirla en los headers. Si no está configurada, la API estará abierta (modo desarrollo).

> **Nota sobre Service y Model:**
> - **service**: Opcional. Especifica qué servicio usar (`groq` o `cerebras`). Si no se especifica, se usa round-robin.
> - **model**: Opcional. Especifica el modelo a usar. Si no se especifica, se usa el modelo por defecto del servicio seleccionado.

**Body:**
- Selecciona **"raw"**
- Selecciona **"JSON"** en el dropdown
- Ingresa el siguiente JSON:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hola, ¿cómo estás?"
    }
  ],
  "language": "español"
}
```

> **Nota:** El parámetro `language` es opcional. Si se proporciona, el modelo responderá en el idioma especificado.

### 3. Enviar la petición

- Clic en **"Send"**
- La respuesta será un **stream** (Server-Sent Events)
- En Postman verás el contenido streaming en tiempo real

### 4. Ejemplo con múltiples mensajes (conversación)

```json
{
  "messages": [
    {
      "role": "system",
      "content": "Eres un asistente útil y amigable."
    },
    {
      "role": "user",
      "content": "Explícame qué es TypeScript"
    }
  ],
  "language": "español"
}
```

### 5. Ejemplo de conversación completa

```json
{
  "messages": [
    {
      "role": "user",
      "content": "¿Cuál es la capital de Francia?"
    },
    {
      "role": "assistant",
      "content": "La capital de Francia es París."
    },
    {
      "role": "user",
      "content": "¿Y cuántos habitantes tiene?"
    }
  ]
}
```

## Headers Disponibles

### Autenticación

La API requiere autenticación mediante API Key. Puedes enviarla de dos formas:

1. **Header Authorization (recomendado):**
   ```
   Authorization: Bearer your-api-key-here
   ```

2. **Header X-API-Key:**
   ```
   X-API-Key: your-api-key-here
   ```

Para configurar la API Key en el servidor, crea un archivo `.env` con:
```
API_KEY=your-secret-api-key-here
```

Si no se configura `API_KEY`, la API estará abierta (modo desarrollo).

### Selección de Servicio

**Header `service` o `X-Service`** (opcional):
- Valores disponibles: `groq`, `cerebras`
- Si no se especifica, se usa round-robin entre los servicios disponibles
- Ejemplo: `service: groq`

### Selección de Modelo

**Header `model` o `X-Model`** (opcional):
- Especifica el modelo a usar para el servicio seleccionado
- Si no se especifica, se usa el modelo por defecto del servicio
- Ejemplos:
  - Groq: `moonshotai/kimi-k2-instruct-0905`
  - Cerebras: `qwen-3-32b`

### Selección de Idioma

**Parámetro `language` en el body** (opcional):
- Especifica el idioma en el que deseas que el modelo responda
- Si se proporciona, se agrega automáticamente una instrucción al sistema para responder en ese idioma
- Ejemplos: `"español"`, `"english"`, `"français"`, `"deutsch"`, `"中文"`, etc.
- Si no se especifica, el modelo responderá en el idioma que considere apropiado

## Notas Importantes

- El servidor debe estar corriendo en el puerto 4000 (o el puerto configurado en `PORT`)
- La respuesta es un **stream** (text/event-stream), por lo que verás el contenido aparecer gradualmente
- Los roles válidos son: `"user"`, `"assistant"`, `"system"`
- Si recibes un error 401, verifica que estés enviando la API key correcta en los headers
- El parámetro `language` se agrega como un mensaje del sistema, por lo que se aplica a toda la conversación

