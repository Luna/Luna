// =====================
// === amplifyConfig ===
// =====================

const IDENTITY_POOL_ID = process.env.NEXT_IDENTITY_POOL_ID
// (required) - Amazon Cognito Region.
const REGION = process.env.REGION || 'us-east-1'
// (optional) - Amazon Cognito User Pool ID.
const USER_POOL_ID = process.env.NEXT_PUBLIC_AUTH_USER_POOL_ID || 'us-east-1_VcFZzGyhv'
// (optional) - Amazon Cognito Web Client ID (26-char alphanumeric string, App client secret needs
// to be disabled).
const USER_POOL_WEB_CLIENT_ID = process.env.NEXT_PUBLIC_AUTH_USER_POOL_WEB_CLIENT_ID || '7vic1uoogbq4aq2rve897j0ep0'
// (required) - Domain that hosts the OAuth endpoints for login, logout, and token refresh.
const DOMAIN = process.env.NEXT_PUBLIC_AUTH_DOMAIN || 'test-enso-pool.auth.us-east-1.amazoncognito.com/'
// (optional) - Redirect to this URL back from Cognito after the user signs in.
const REDIRECT_SIGN_IN = process.env.NEXT_PUBLIC_AUTH_REDIRECT_SIGN_IN || 'enso://localhost'
// (optional) - Redirect to this URL back from Cognito after the user signs out.
const REDIRECT_SIGN_OUT = process.env.NEXT_PUBLIC_AUTH_REDIRECT_SIGN_OUT || 'enso://localhost'
// (optional) - Response type of the OAuth flow. Replaces the default of 'token' since we want to be
// provided a refresh token.
const RESPONSE_TYPE = "code";

const GITHUB_ENDPOINT_NAME = 'GitHub'
const GITHUB_ENDPOINT_URL = 'https://py4rm53d36.execute-api.us-east-1.amazonaws.com/signin'

/// Configuration object to configure Amplify library, which provides our authentication
/// functionality via external OAuth providers (e.g. Google) through Amazon Cognito.
export const amplifyConfig = {
    region: REGION,
    identityPoolId: IDENTITY_POOL_ID,
    userPoolId: USER_POOL_ID,
    userPoolWebClientId: USER_POOL_WEB_CLIENT_ID,
    oauth: {
        options: {},
        domain: DOMAIN,
        scope: ['email', 'openid'],
        redirectSignIn: REDIRECT_SIGN_IN,
        redirectSignOut: REDIRECT_SIGN_OUT,
        responseType: RESPONSE_TYPE,
    }
};
