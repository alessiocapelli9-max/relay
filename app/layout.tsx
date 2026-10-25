import type {Metadata} from 'next';
import '../src/style.css';
import '../src/editorial.css';
import '../src/flow.css';
import '../src/accounts.css';
export const metadata:Metadata={title:'Relay · Your shared care plan',description:'Make a care plan together. Share tasks, invite family, and keep everyone up to date.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
