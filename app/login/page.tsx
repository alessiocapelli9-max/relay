import {configured} from '../../lib/supabase/server';
import AuthForm from '../../src/AuthForm';
export default function Login(){return <AuthForm configured={configured()} emailAuth={process.env.NEXT_PUBLIC_EMAIL_AUTH_ENABLED!=='false'} google={process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED==='true'}/>;}
