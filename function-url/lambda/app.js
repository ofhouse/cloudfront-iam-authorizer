async function handler() {
  return {
    statusCode: 200,
    body: JSON.stringify({ hello: 'world' }),
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  };
}

exports.handler = handler;
