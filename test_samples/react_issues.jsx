import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// Component with multiple hook issues
function UserDashboard({ userId }) {
    // Hook called conditionally (BAD!)
    if (userId) {
        const [user, setUser] = useState(null);
    }

    // Missing dependency (BAD!)
    useEffect(() => {
        fetchUserData(userId);
    }, []); // userId missing from deps

    // State update in effect without deps (BAD!)
    useEffect(() => {
        setUser(fetchedData);
    });

    // Multiple state updates without batching (BAD!)
    const handleUpdate = () => {
        setCount(count + 1);
        setTotal(total + count);
        setAverage(total / items.length);
    };

    // Memory leak - no cleanup (BAD!)
    useEffect(() => {
        const subscription = dataStream.subscribe(data => {
            console.log(data);
        });
    }, []);

    // Stale closure in callback (BAD!)
    const handleClick = () => {
        setTimeout(() => {
            setCount(count + 1);
        }, 1000);
    };

    return <div>Dashboard</div>;
}

// Component with ref issues
function VideoPlayer({ src }) {
    const videoRef = useRef();
    const [playing, setPlaying] = useState(false);

    // Ref mutation in render (BAD!)
    videoRef.current = new VideoPlayer();

    // Missing ref null check (BAD!)
    useEffect(() => {
        videoRef.current.play();
    }, [playing]);

    return <video ref={videoRef} />;
}

// Component with performance issues
function ExpensiveList({ items }) {
    // Missing useMemo for expensive computation (BAD!)
    const sortedItems = items.sort((a, b) => b.value - a.value);

    // Missing useCallback for handler (BAD!)
    const handleClick = () => {
        console.log('clicked');
    };

    // Inline object creation causing rerenders (BAD!)
    return (
        <div style={{ width: '100%' }}>
            {sortedItems.map(item => (
                <Item key={item.id} data={item} onClick={handleClick} />
            ))}
        </div>
    );
}

// Component with state management issues
function UserProfile({ user }) {
    const [data, setData] = useState(user);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Race condition in data fetching (BAD!)
    useEffect(() => {
        let mounted = true;
        setLoading(true);
        fetchUserData(user.id).then(result => {
            setData(result);
            setLoading(false);
        });
    }, [user.id]);

    // Unnecessary state updates (BAD!)
    const updateProfile = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await updateUser(data);
            setData(result);
            setSuccess(true);
            setMessage('Updated successfully');
        } catch (err) {
            setError(err);
            setSuccess(false);
            setMessage('Update failed');
        }
        setLoading(false);
    };

    // Event listener memory leak (BAD!)
    useEffect(() => {
        window.addEventListener('resize', handleResize);
    }, []);

    return <div>Profile</div>;
}

// Component with context issues
function Header() {
    // Context value without memoization (BAD!)
    return (
        <ThemeContext.Provider value={{ theme: 'dark', toggle: () => {} }}>
            <Nav />
        </ThemeContext.Provider>
    );
}

// Component with prop drilling
function DeepChild({ user, theme, onUpdate, items }) {
    // Prop drilling instead of context (BAD!)
    return (
        <div>
            <DeepGrandChild
                user={user}
                theme={theme}
                onUpdate={onUpdate}
                items={items}
            />
        </div>
    );
}

// Component with dangerouslySetInnerHTML
function Comment({ content }) {
    // XSS vulnerability (BAD!)
    return <div dangerouslySetInnerHTML={{ __html: content }} />;
}

export default function App() {
    // Multiple contexts causing rerenders (BAD!)
    return (
        <ThemeContext.Provider value={theme}>
            <UserContext.Provider value={user}>
                <DataContext.Provider value={data}>
                    <SettingsContext.Provider value={settings}>
                        <MainContent />
                    </SettingsContext.Provider>
                </DataContext.Provider>
            </UserContext.Provider>
        </ThemeContext.Provider>
    );
}
