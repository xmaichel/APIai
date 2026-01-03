const server = Bun.serve({
    port: process.env.PORT ??  4000,
    async fetch(req) {
        return new Response("API de bun funcionando");
    }
});
console.log(`Server is running on ${server.url}:${server.port}`);