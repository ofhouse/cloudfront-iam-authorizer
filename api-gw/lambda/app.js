async function handler() {
  return {
    statusCode: 200,
    body: JSON.stringify({ hello: 'world' }),
    headers: {
      'content-type': 'application/json',
    },
  };
}

exports.handler = handler;
