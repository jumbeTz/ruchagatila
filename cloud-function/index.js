const sdk = require('node-appwrite');

module.exports = async function(req, res) {
    const startTime = Date.now();
    const requestId = 'req_' + Date.now().toString(36);
    
    let payload;
    try {
        payload = JSON.parse(req.body || '{}');
    } catch (e) {
        return res.json({ success: false, error: 'Invalid JSON' });
    }
    
    const { action, userId, newPassword } = payload;
    
    console.log('[' + requestId + '] Action:', action);
    console.log('[' + requestId + '] User ID:', userId);
    console.log('[' + requestId + '] Password length:', newPassword ? newPassword.length : 0);
    
    const endpoint = process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
    const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID || '6a42691c0006e65e22b2';
    const apiKey = process.env.APPWRITE_API_KEY;
    
    if (!apiKey) {
        console.log('[' + requestId + '] ERROR: API key not configured');
        return res.json({ success: false, error: 'API key not configured' });
    }
    
    const client = new sdk.Client();
    const users = new sdk.Users(client);
    client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    
    if (action === 'ping') {
        return res.json({ success: true, message: 'pong', timestamp: new Date().toISOString() });
    }
    
    if (action === 'getUser') {
        if (!userId) return res.json({ success: false, error: 'userId required' });
        try {
            const user = await users.get(userId);
            return res.json({ success: true, user: { id: user.$id, name: user.name, email: user.email, status: user.status } });
        } catch (e) {
            return res.json({ success: false, error: e.message, code: e.code || 'unknown' });
        }
    }
    
    if (action === 'adminGenerateTempPassword' || action === 'adminUpdatePassword') {
        if (!userId) return res.json({ success: false, error: 'userId required' });
        if (!newPassword) return res.json({ success: false, error: 'newPassword required' });
        
        let userName = 'Unknown', userEmail = 'Unknown';
        
        try {
            const user = await users.get(userId);
            userName = user.name || 'Unknown';
            userEmail = user.email || 'Unknown';
            console.log('[' + requestId + '] User found:', userName, userEmail);
        } catch (verifyErr) {
            return res.json({ success: false, error: 'User not found: ' + verifyErr.message, code: verifyErr.code || 'unknown' });
        }
        
        let passwordUpdated = false, sdkErrorMsg = '';
        
        try {
            await users.updatePassword(userId, newPassword);
            passwordUpdated = true;
            console.log('[' + requestId + '] SDK update successful');
        } catch (sdkErr) {
            sdkErrorMsg = sdkErr.message;
            console.log('[' + requestId + '] SDK failed:', sdkErr.message);
            
            try {
                const fetch = require('node-fetch');
                const response = await fetch(endpoint + '/users/' + userId + '/password', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'X-Appwrite-Project': projectId, 'X-Appwrite-Key': apiKey },
                    body: JSON.stringify({ password: newPassword })
                });
                
                if (response.ok) {
                    passwordUpdated = true;
                    console.log('[' + requestId + '] REST API fallback successful');
                } else {
                    const errText = await response.text();
                    console.log('[' + requestId + '] REST API failed:', errText.substring(0, 200));
                }
            } catch (restErr) {
                console.log('[' + requestId + '] REST API error:', restErr.message);
            }
        }
        
        if (passwordUpdated) {
            return res.json({ success: true, message: 'Password updated', userId: userId, userName: userName, userEmail: userEmail, timestamp: new Date().toISOString() });
        } else {
            return res.json({ success: false, error: 'Failed to update password', sdkError: sdkErrorMsg, userId: userId, userName: userName, userEmail: userEmail });
        }
    }
    
    if (action === 'changePasswordAfterTempLogin') {
        if (!userId || !newPassword) return res.json({ success: false, error: 'userId and newPassword required' });
        try {
            await users.updatePassword(userId, newPassword);
            return res.json({ success: true, message: 'Password changed', userId: userId, timestamp: new Date().toISOString() });
        } catch (e) {
            return res.json({ success: false, error: e.message, code: e.code || 'unknown' });
        }
    }
    
    return res.json({ success: false, error: 'Unknown action: ' + action, supportedActions: ['ping', 'getUser', 'adminGenerateTempPassword', 'adminUpdatePassword', 'changePasswordAfterTempLogin'] });
};
