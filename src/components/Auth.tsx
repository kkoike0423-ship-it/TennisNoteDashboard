import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Lock, Mail, Loader2 } from 'lucide-react';

export default function Auth() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMSG, setErrorMSG] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMSG('');
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) setErrorMSG(error.message);
        setLoading(false);
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMSG('');
        const { error } = await supabase.auth.signUp({
            email,
            password,
        });
        if (error) setErrorMSG(error.message);
        else setErrorMSG('Check your email for the login link!');
        setLoading(false);
    };

    return (
        <div className="flex justify-center items-center min-h-screen p-4">
            <div className="glass-panel p-8 max-w-md w-full animate-fade-in relative z-10">
                <div className="mb-8 text-center">
                    <div className="w-16 h-16 bg-tennis-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-tennis-green-500/30">
                        <span className="text-white font-bold text-2xl">TN</span>
                    </div>
                    <h1 className="text-2xl font-bold bg-gradient-to-br from-tennis-green-700 to-tennis-green-500 bg-clip-text text-transparent">
                        TennisNote Dashboard
                    </h1>
                    <p className="text-sm text-gray-500 mt-2">Sign in to manage your data</p>
                </div>

                <form className="space-y-4" onSubmit={handleLogin}>
                    <div>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                            <input
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-tennis-green-500 focus:border-transparent outline-none transition-all bg-white/50"
                                type="email"
                                placeholder="Your email"
                                value={email}
                                required
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                            <input
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-tennis-green-500 focus:border-transparent outline-none transition-all bg-white/50"
                                type="password"
                                placeholder="Your password"
                                value={password}
                                required
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {errorMSG && <p className="text-red-500 text-sm">{errorMSG}</p>}

                    <div className="pt-2 flex flex-col gap-3">
                        <button
                            className="w-full bg-tennis-green-500 hover:bg-tennis-green-700 text-white font-semibold py-2.5 rounded-lg shadow-md transition-all flex justify-center items-center"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Log In'}
                        </button>
                        <button
                            type="button"
                            className="w-full bg-transparent border border-tennis-green-500 text-tennis-green-700 hover:bg-tennis-green-50 font-semibold py-2.5 rounded-lg transition-all"
                            onClick={handleSignUp}
                            disabled={loading}
                        >
                            Sign Up
                        </button>
                    </div>
                </form>
            </div>

            {/* Decorative background elements */}
            <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-tennis-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
            <div className="fixed top-1/3 right-1/4 w-72 h-72 bg-tennis-green-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        </div>
    );
}
