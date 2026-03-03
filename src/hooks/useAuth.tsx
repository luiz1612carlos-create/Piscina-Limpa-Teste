import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { UserData } from '../types';

export const useAuth = () => {
    const [user, setUser] = useState<any | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeDoc: () => void = () => {};

        const unsubscribeAuth = auth.onAuthStateChanged((firebaseUser: any) => {
            setUser(firebaseUser);
            
            if (firebaseUser) {
                if (firebaseUser.isAnonymous) {
                    setUserData(null);
                    setLoading(false);
                } else {
                    // Importante: Só marcamos loading como false após o primeiro snapshot (sucesso ou erro)
                    unsubscribeDoc = db.collection('users').doc(firebaseUser.uid).onSnapshot((doc: any) => {
                        if (doc.exists) {
                            setUserData(doc.data() as UserData);
                        } else {
                            setUserData(null);
                        }
                        setLoading(false);
                    }, (error: any) => {
                        // Se houver erro de permissão, pode ser que o documento não exista 
                        // ou as regras estejam restritivas. Não travamos o app.
                        console.warn("Aviso: Não foi possível carregar dados do perfil (permissão ou inexistente).", error);
                        setUserData(null);
                        setLoading(false);
                    });
                }
            } else {
                setUserData(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            unsubscribeDoc();
        };
    }, []);

    const login = (email: string, pass: string) => {
        return auth.signInWithEmailAndPassword(email, pass);
    };

    const loginAnonymously = () => {
        return auth.signInAnonymously();
    };

    const logout = () => {
        return auth.signOut();
    };

    const changePassword = async (newPass: string) => {
        if (user) {
            await user.updatePassword(newPass);
        } else {
            throw new Error("No user signed in");
        }
    };

    return { 
        user, 
        userData, 
        loading, 
        isAnonymous: user?.isAnonymous || false,
        login, 
        loginAnonymously, 
        logout, 
        changePassword 
    };
};