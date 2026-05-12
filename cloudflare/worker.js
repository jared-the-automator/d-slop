export default {
  async fetch(request, env) {
    const rules = await env.RULES.get('rules');
    if (!rules) {
      return new Response('Rules not found', { status: 404 });
    }
    return new Response(rules, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  },
};
