import {configured,supabaseServer} from '../lib/supabase/server';
import Account from '../src/Account';
export const dynamic='force-dynamic';
export default async function Page(){let user=null;if(configured()){const client=await supabaseServer();user=(await client.auth.getUser()).data.user;}return <Account user={user?{id:user.id,name:user.user_metadata?.display_name||''}:null} signIn="/login" signOut="/auth/signout"/>;}
