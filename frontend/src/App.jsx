import {  SignInButton, SignUpButton, UserButton } from '@clerk/react'

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 flex flex-col items-center justify-start">
      
      <header className="w-full max-w-2xl flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-border rounded-xl shadow-md transition-all">
        <h1 className="text-xl font-bold tracking-tight text-primary">ChatApp</h1>
        
        <div className="flex items-center gap-3">
            <SignInButton mode="modal">
              <button className="px-4 py-2 text-sm font-medium text-white bg-black hover:bg-zinc-800 rounded-lg cursor-pointer transition">
                Sign In
              </button>
            </SignInButton>
            
            <SignUpButton mode="modal">
              <button className="px-4 py-2 text-sm font-medium text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-border rounded-lg cursor-pointer transition">
                Sign Up
              </button>
            </SignUpButton>

 
            <UserButton afterSignOutUrl="/" />
        </div>
      </header>
    </div>
  )
}

export default App