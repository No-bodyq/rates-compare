import { Amplify } from 'aws-amplify';
import { signIn, signOut, fetchAuthSession } from 'aws-amplify/auth';

export const configureAmplify = () => {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: import.meta.env.VITE_USER_POOL_ID,
        userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
      }
    }
  });
};

export const getPCXAuthToken = async () => {
  try {
    console.log('Getting PCX auth token from frontend...');
    
    // Clear any existing session
    try {
      await signOut();
    } catch (error) {
      console.log('No existing session to clear');
    }

    await signIn({
      username: 'hehoh88289@ethsms.com',
      password: 'hehoh88289@ethsms.com',
    });

    const authSession = await fetchAuthSession();
    
    const accessToken = authSession.tokens?.accessToken?.toString();
    const idToken = authSession.tokens?.idToken?.toString();
    const expiresIn = authSession.tokens?.accessToken?.payload?.exp;

    if (!accessToken) {
      throw new Error('No access token received');
    }

    console.log('✅ PCX authentication successful from frontend');

    return {
      success: true,
      token: accessToken,
      idToken: idToken,
      expiresIn: expiresIn,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Frontend PCX authentication error:', error);
    throw error;
  }
};