import React from 'react';
import { NotificationType } from '../types';
export const Notification = ({ message, type, onClose }: { message: string, type: NotificationType, onClose: () => void }) => (
    <div className={`fixed top-4 right-4 p-4 rounded shadow-lg z-50 text-white ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}>
        {message}
        <button onClick={onClose} className="ml-4 font-bold">X</button>
    </div>
);