import { useState, useEffect } from 'react';

export interface SystemData {
    time: Date;
    battery: {
        level: number;
        charging: boolean;
    };
    network: {
        type: string;
        speed: number; // Mbps
        online: boolean;
    };
    performance: {
        cpuUsage: number;
        memoryUsage: number;
        temperature: number;
    };
}

export const useSystemData = () => {
    const [data, setData] = useState<SystemData>({
        time: new Date(),
        battery: { level: 100, charging: true },
        network: { type: 'wifi', speed: 100, online: true },
        performance: { cpuUsage: 0, memoryUsage: 0, temperature: 45 },
    });

    // Time Update
    useEffect(() => {
        const timer = setInterval(() => {
            setData(prev => ({ ...prev, time: new Date() }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Battery Update (Real API)
    useEffect(() => {
        // @ts-ignore
        if (navigator.getBattery) {
            // @ts-ignore
            navigator.getBattery().then(battery => {
                const updateBattery = () => {
                    setData(prev => ({
                        ...prev,
                        battery: {
                            level: Math.round(battery.level * 100),
                            charging: battery.charging
                        }
                    }));
                };
                updateBattery();
                battery.addEventListener('levelchange', updateBattery);
                battery.addEventListener('chargingchange', updateBattery);
                return () => {
                    battery.removeEventListener('levelchange', updateBattery);
                    battery.removeEventListener('chargingchange', updateBattery);
                };
            });
        }
    }, []);

    // Network Status
    useEffect(() => {
        const updateNetwork = () => {
            // @ts-ignore
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            setData(prev => ({
                ...prev,
                network: {
                    type: connection?.effectiveType || 'wifi',
                    speed: connection?.downlink ? connection.downlink * 10 : 100, // Roughly Mbps
                    online: navigator.onLine
                }
            }));
        };

        window.addEventListener('online', updateNetwork);
        window.addEventListener('offline', updateNetwork);
        updateNetwork();

        return () => {
            window.removeEventListener('online', updateNetwork);
            window.removeEventListener('offline', updateNetwork);
        };
    }, []);

    // Simulating Performance Fluctuations
    useEffect(() => {
        const interval = setInterval(() => {
            setData(prev => {
                // Randomly fluctuate based on previous values to look natural
                const cpuChange = (Math.random() - 0.5) * 5; // +/- 2.5%
                const memChange = (Math.random() - 0.5) * 2; // +/- 1%

                // Keep within realistic bounds
                const newCpu = Math.min(Math.max(prev.performance.cpuUsage + cpuChange, 5), 90);
                const newMem = Math.min(Math.max(prev.performance.memoryUsage + memChange, 20), 80);

                return {
                    ...prev,
                    performance: {
                        cpuUsage: Math.round(newCpu),
                        memoryUsage: Math.round(newMem),
                        temperature: 40 + (newCpu / 5) // roughly correlates with CPU
                    }
                };
            });
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    return data;
};
