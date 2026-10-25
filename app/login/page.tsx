import {configured} from '../../lib/supabase/server';
import AuthForm from '../../src/AuthForm';
export default function Login(){return <AuthForm configured={configured()} google={process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED==='true'}/>;}
