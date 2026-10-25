import {configured} from '../../lib/supabase/server';
import AuthForm from '../../src/AuthForm';
export default function Reset(){return <AuthForm configured={configured()} reset/>;}
