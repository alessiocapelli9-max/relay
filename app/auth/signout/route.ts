import {NextResponse} from 'next/server';
import {supabaseServer} from '../../../lib/supabase/server';
export async function POST(request:Request){const url=new URL(request.url);if(request.headers.get('origin')!==url.origin)return new Response('Invalid origin',{status:403});const client=await supabaseServer();await client.auth.signOut();return NextResponse.redirect(new URL('/',url.origin),303);}
