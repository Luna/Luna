if (!process.env.NEXT_PUBLIC_AUTH_USER_POOL_ID) {
    throw new Error("NEXT_PUBLIC_AUTH_USER_POOL_ID");
}
if (!process.env.NEXT_PUBLIC_AUTH_USER_POOL_WEB_CLIENT_ID) {
    throw new Error("NEXT_PUBLIC_AUTH_USER_POOL_WEB_CLIENT_ID");
}
if (!process.env.NEXT_PUBLIC_AUTH_DOMAIN) {
    throw new Error("NEXT_PUBLIC_AUTH_DOMAIN");
}
if (!process.env.NEXT_PUBLIC_AUTH_REDIRECT_SIGN_IN) {
    throw new Error("NEXT_PUBLIC_AUTH_REDIRECT_SIGN_IN");
}
if (!process.env.NEXT_PUBLIC_AUTH_REDIRECT_SIGN_OUT) {
    throw new Error("NEXT_PUBLIC_AUTH_REDIRECT_SIGN_OUT");
}

// =====================
// === amplifyConfig ===
// =====================

// (required) - Amazon Cognito Region.
const REGION = "eu-west-1";
// (optional) - Amazon Cognito User Pool ID.
const USER_POOL_ID = process.env.NEXT_PUBLIC_AUTH_USER_POOL_ID;
// (optional) - Amazon Cognito Web Client ID (26-char alphanumeric string, App client secret needs
// to be disabled).
const USER_POOL_WEB_CLIENT_ID = process.env.NEXT_PUBLIC_AUTH_USER_POOL_WEB_CLIENT_ID;
// (required) - Domain that hosts the OAuth endpoints for login, logout, and token refresh.
const DOMAIN = process.env.NEXT_PUBLIC_AUTH_DOMAIN;
// (optional) - Redirect to this URL back from Cognito after the user signs in.
const REDIRECT_SIGN_IN = process.env.NEXT_PUBLIC_AUTH_REDIRECT_SIGN_IN;
// (optional) - Redirect to this URL back from Cognito after the user signs out.
const REDIRECT_SIGN_OUT = process.env.NEXT_PUBLIC_AUTH_REDIRECT_SIGN_OUT;
// (optional) - Response type of the OAuth flow. Replaces the default of 'token' since we want to be
// provided a refresh token.
const RESPONSE_TYPE = "code";

/// Configuration object to configure Amplify library, which provides our authentication
/// functionality via external OAuth providers (e.g. Google) through Amazon Cognito.
export const amplifyConfig = {
    region: REGION,
    userPoolId: USER_POOL_ID,
    userPoolWebClientId: USER_POOL_WEB_CLIENT_ID,
    oauth: {
        domain: DOMAIN,
        redirectSignIn: REDIRECT_SIGN_IN,
        redirectSignOut: REDIRECT_SIGN_OUT,
        responseType: RESPONSE_TYPE,
    }
};
