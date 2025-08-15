
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

const SESSION_TIMEOUT_MINUTES = 30;
const WARNING_MINUTES = 5;

export function useSessionTimeout() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [isActive, setIsActive] = useState(true);
  const [timeLeft, setTimeLeft] = useState(SESSION_TIMEOUT_MINUTES * 60);
  const [showWarning, setShowWarning] = useState(false);

  const resetTimeout = useCallback(() => {
    setTimeLeft(SESSION_TIMEOUT_MINUTES * 60);
    setShowWarning(false);
    setIsActive(true);
  }, []);

  const handleActivity = useCallback(() => {
    if (user) {
      resetTimeout();
    }
  }, [user, resetTimeout]);

  const extendSession = useCallback(() => {
    resetTimeout();
    toast({
      title: "Session Extended",
      description: "Your session has been extended for 30 more minutes.",
    });
  }, [resetTimeout, toast]);

  const handleLogout = useCallback(async () => {
    await signOut();
    toast({
      title: "Session Expired",
      description: "You have been logged out due to inactivity.",
      variant: "destructive",
    });
  }, [signOut, toast]);

  useEffect(() => {
    if (!user || !isActive) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1;
        
        if (newTime <= WARNING_MINUTES * 60 && !showWarning) {
          setShowWarning(true);
        }
        
        if (newTime <= 0) {
          handleLogout();
          return 0;
        }
        
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [user, isActive, showWarning, handleLogout]);

  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [user, handleActivity]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    timeLeft,
    showWarning,
    extendSession,
    formatTime: formatTime(timeLeft),
    isActive: user && isActive,
  };
}
