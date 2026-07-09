# tiny-json-api

Smallest possible backend — a Node.js server with **two JSON endpoints** and **zero dependencies**.

## Quick Start

```bash
npm start
```

Server starts on `http://localhost:3000`.

## Endpoints

| Method | Path         | Description                  |
|--------|--------------|------------------------------|
| GET    | `/api/hello` | Returns a greeting + timestamp |
| GET    | `/api/time`  | Returns current UTC time + unix timestamp |

## Test with curl

```bash
curl http://localhost:3000/api/hello
curl http://localhost:3000/api/time
```

## Test in browser

Open [http://localhost:3000/api/hello](http://localhost:3000/api/hello) or [http://localhost:3000/api/time](http://localhost:3000/api/time).
