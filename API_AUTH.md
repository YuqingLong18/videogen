# Kling AI API Authentication

## Overview
The Kling AI API uses **JWT (JSON Web Token) authentication** with two keys:
- **Access Key (AK)**: Used as the `iss` (issuer) claim in the JWT payload
- **Secret Key (SK)**: Used to sign the JWT token with HS256 algorithm

## Environment Variables Required

Update your `.env` file with both keys:

```env
KLING_ACCESS_KEY=your_access_key_here
KLING_SECRET_KEY=your_secret_key_here
PORT=3000
```

## How It Works

### JWT Token Generation
The server generates a fresh JWT token for each API request:

```javascript
function generateKlingToken() {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: KLING_ACCESS_KEY,  // Access Key as issuer
        exp: now + 1800,         // Token expires in 30 minutes
        nbf: now - 5             // Token valid from 5 seconds ago
    };
    
    return jwt.sign(payload, KLING_SECRET_KEY, { algorithm: 'HS256' });
}
```

### API Request Flow
1. Client makes request to `/api/text2video` or `/api/image2video`
2. Server generates JWT token using Access Key and Secret Key
3. Server includes token in Authorization header: `Bearer <token>`
4. Kling API validates the JWT token and processes the request

## Getting Your API Keys

1. Go to [Kling AI Developer Console](https://app.klingai.com/cn/dev)
2. Create an API key pair
3. **Important**: Copy both the Access Key and Secret Key immediately
4. The Secret Key cannot be viewed again after creation

## References
- [Kling API Documentation](https://app.klingai.com/cn/dev/document-api)
- JWT Standard: RFC 7519
