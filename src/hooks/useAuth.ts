import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { UserData } from '../types';

export const useAuth = () => {
    const [user, setUser] = useState<any | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeDoc: () => void = () => {};

        const unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser: any) => {
            setUser(firebaseUser);
            
            if (firebaseUser) {
                if (firebaseUser.isAnonymous) {
                    setUserData(null);
                    setLoading(false);
                } else {
                    unsubscribeDoc = db.collection('users').doc(firebaseUser.uid).onSnapshot((doc: any) => {
                        if (doc.exists) {
                            setUserData(doc.data() as UserData);
                        } else {
                            setUserData(null);
                        }
                        setLoading(false);
                    }, (error: any) => {
                        console.error("Error fetching user data:", error);
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
        logout, 
        changePassword 
    };
};