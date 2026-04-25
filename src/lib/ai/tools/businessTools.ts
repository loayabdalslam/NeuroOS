/**
 * Business Suite Tools — Curated Composio integrations for Gmail, Slack, Sheets, Notion, GitHub, HubSpot, Calendar
 */
import { registerTool, ToolResult } from '../toolEngine';
import { composioClient } from '../../composio/composioClient';
import { useComposioStore } from '../../../stores/composioStore';

function requireApp(appId: string): ToolResult | null {
    const store = useComposioStore.getState();
    if (!store.isAuthenticated) {
        return {
            success: false,
            message: 'Composio not configured. Add your API key in Settings or the Integrations app.',
            data: { action: 'connect_integration', appId }
        };
    }
    const conn = store.connections.find(c => c.appId === appId);
    if (!conn || conn.status !== 'connected') {
        return {
            success: false,
            message: `${appId} is not connected. Use the connect_integration tool to connect it, or open the Integrations app.`,
            data: { action: 'connect_integration', appId }
        };
    }
    return null;
}

async function execComposio(actionId: string, params: Record<string, any>, appId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    return composioClient.executeTool(actionId, params, appId);
}

// ─── Gmail ─────────────────────────────────────────────────────────

registerTool({
    name: 'send_email',
    description: 'Send an email via Gmail integration (NOT browser). Use for: "send email", "email someone", "write an email", "compose email". Supports to, cc, bcc, subject, and body.',
    category: 'business',
    parameters: {
        to: { type: 'string', description: 'Recipient email address', required: true },
        subject: { type: 'string', description: 'Email subject line', required: true },
        body: { type: 'string', description: 'Email body (plain text or HTML)', required: true },
        cc: { type: 'string', description: 'CC recipients (comma-separated)', required: false },
        bcc: { type: 'string', description: 'BCC recipients (comma-separated)', required: false },
    },
    requiresConfirmation: true,
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('gmail');
        if (err) return err;
        const result = await execComposio('GMAIL_SEND_EMAIL', {
            to: args.to, subject: args.subject, body: args.body,
            ...(args.cc && { cc: args.cc }),
            ...(args.bcc && { bcc: args.bcc }),
        }, 'gmail');
        if (result.success) return { success: true, message: `Email sent to ${args.to}: "${args.subject}"`, data: result.data };
        return { success: false, message: result.error || 'Failed to send email' };
    },
});

registerTool({
    name: 'read_emails',
    description: 'Read recent emails from Gmail integration (NOT browser). Use for: "get latest email", "check email", "read inbox", "show my emails", "any new emails".',
    category: 'business',
    parameters: {
        count: { type: 'string', description: 'Number of emails to fetch (default 10)', required: false },
        folder: { type: 'string', description: 'Folder/label to read from (default INBOX)', required: false },
        unread_only: { type: 'string', description: 'Only show unread emails (true/false)', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('gmail');
        if (err) return err;
        const result = await execComposio('GMAIL_LIST_EMAILS', {
            maxResults: parseInt(args.count || '10', 10),
            labelIds: args.folder || 'INBOX',
            ...(args.unread_only === 'true' && { q: 'is:unread' }),
        }, 'gmail');
        if (result.success) {
            const emails = result.data?.emails || result.data || [];
            if (Array.isArray(emails) && emails.length > 0) {
                const list = emails.map((e: any) => `• **${e.subject || 'No subject'}** from ${e.from || 'unknown'} — ${e.snippet || ''}`).join('\n');
                return { success: true, message: `**Emails (${emails.length}):**\n${list}`, data: emails };
            }
            return { success: true, message: 'No emails found.', data: result.data };
        }
        return { success: false, message: result.error || 'Failed to read emails' };
    },
});

registerTool({
    name: 'search_emails',
    description: 'Search Gmail emails via integration (NOT browser). Use for: "find email from X", "search emails about Y", "email from alice".',
    category: 'business',
    parameters: {
        query: { type: 'string', description: 'Gmail search query', required: true },
    },
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('gmail');
        if (err) return err;
        const result = await execComposio('GMAIL_SEARCH_EMAILS', { q: args.query }, 'gmail');
        if (result.success) {
            const emails = result.data?.emails || result.data || [];
            if (Array.isArray(emails) && emails.length > 0) {
                const list = emails.map((e: any) => `• **${e.subject || 'No subject'}** from ${e.from || 'unknown'}`).join('\n');
                return { success: true, message: `**Search results (${emails.length}):**\n${list}`, data: emails };
            }
            return { success: true, message: `No emails found for "${args.query}".` };
        }
        return { success: false, message: result.error || 'Email search failed' };
    },
});

// ─── Slack ──────────────────────────────────────────────────────────

registerTool({
    name: 'send_slack_message',
    description: 'Send a Slack message via integration (NOT browser). Use for: "send slack message", "message on slack", "post to #channel", "DM someone on slack".',
    category: 'business',
    parameters: {
        channel: { type: 'string', description: 'Channel name (e.g. #general) or user ID for DM', required: true },
        message: { type: 'string', description: 'Message text (supports Slack markdown)', required: true },
    },
    requiresConfirmation: true,
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('slack');
        if (err) return err;
        const result = await execComposio('SLACK_SEND_MESSAGE', {
            channel: args.channel.replace(/^#/, ''),
            text: args.message,
        }, 'slack');
        if (result.success) return { success: true, message: `Message sent to ${args.channel}`, data: result.data };
        return { success: false, message: result.error || 'Failed to send Slack message' };
    },
});

registerTool({
    name: 'list_slack_channels',
    description: 'List Slack channels via integration (NOT browser). Use for: "show slack channels", "what channels are there".',
    category: 'business',
    parameters: {},
    handler: async (): Promise<ToolResult> => {
        const err = requireApp('slack');
        if (err) return err;
        const result = await execComposio('SLACK_LIST_CHANNELS', {}, 'slack');
        if (result.success) {
            const channels = result.data?.channels || result.data || [];
            if (Array.isArray(channels) && channels.length > 0) {
                const list = channels.map((c: any) => `• #${c.name} — ${c.topic?.value || c.purpose?.value || ''}`).join('\n');
                return { success: true, message: `**Slack Channels (${channels.length}):**\n${list}`, data: channels };
            }
            return { success: true, message: 'No channels found.', data: result.data };
        }
        return { success: false, message: result.error || 'Failed to list channels' };
    },
});

registerTool({
    name: 'read_slack_messages',
    description: 'Read Slack messages via integration (NOT browser). Use for: "read slack messages", "what are people saying in #general", "check slack".',
    category: 'business',
    parameters: {
        channel: { type: 'string', description: 'Channel name (e.g. general)', required: true },
        count: { type: 'string', description: 'Number of messages to fetch (default 20)', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('slack');
        if (err) return err;
        const result = await execComposio('SLACK_LIST_MESSAGES', {
            channel: args.channel.replace(/^#/, ''),
            limit: parseInt(args.count || '20', 10),
        }, 'slack');
        if (result.success) {
            const messages = result.data?.messages || result.data || [];
            if (Array.isArray(messages) && messages.length > 0) {
                const list = messages.map((m: any) => `• **${m.user || 'unknown'}**: ${m.text || ''}`).join('\n');
                return { success: true, message: `**Messages from #${args.channel} (${messages.length}):**\n${list}`, data: messages };
            }
            return { success: true, message: `No messages in #${args.channel}.` };
        }
        return { success: false, message: result.error || 'Failed to read messages' };
    },
});

// ─── Google Sheets ──────────────────────────────────────────────────

registerTool({
    name: 'read_spreadsheet',
    description: 'Read Google Sheets data via integration (NOT browser). Use for: "read spreadsheet", "get sheet data", "show spreadsheet".',
    category: 'business',
    parameters: {
        spreadsheet_id: { type: 'string', description: 'Spreadsheet ID (from the URL)', required: true },
        range: { type: 'string', description: 'Cell range (e.g. Sheet1!A1:D10)', required: true },
    },
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('googlesheets');
        if (err) return err;
        const result = await execComposio('GOOGLESHEETS_GET_VALUES', {
            spreadsheetId: args.spreadsheet_id,
            range: args.range,
        }, 'googlesheets');
        if (result.success) {
            const values = result.data?.values || result.data || [];
            return { success: true, message: `**Data from ${args.range}:**\n${JSON.stringify(values, null, 2)}`, data: values };
        }
        return { success: false, message: result.error || 'Failed to read spreadsheet' };
    },
});

registerTool({
    name: 'write_spreadsheet',
    description: 'Write to Google Sheets via integration (NOT browser). Use for: "update spreadsheet", "write to sheet", "add data to spreadsheet".',
    category: 'business',
    parameters: {
        spreadsheet_id: { type: 'string', description: 'Spreadsheet ID', required: true },
        range: { type: 'string', description: 'Cell range (e.g. Sheet1!A1)', required: true },
        values: { type: 'string', description: 'Data as JSON array of arrays (e.g. [["a","b"],["c","d"]])', required: true },
    },
    requiresConfirmation: true,
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('googlesheets');
        if (err) return err;
        let values: any[][];
        try { values = JSON.parse(args.values); } catch { return { success: false, message: 'Invalid JSON for values. Expected array of arrays.' }; }
        const result = await execComposio('GOOGLESHEETS_UPDATE_VALUES', {
            spreadsheetId: args.spreadsheet_id,
            range: args.range,
            values,
        }, 'googlesheets');
        if (result.success) return { success: true, message: `Data written to ${args.range}`, data: result.data };
        return { success: false, message: result.error || 'Failed to write to spreadsheet' };
    },
});

registerTool({
    name: 'create_spreadsheet',
    description: 'Create a Google Sheets spreadsheet via integration (NOT browser). Use for: "create spreadsheet", "new google sheet".',
    category: 'business',
    parameters: {
        title: { type: 'string', description: 'Spreadsheet title', required: true },
    },
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('googlesheets');
        if (err) return err;
        const result = await execComposio('GOOGLESHEETS_CREATE_SPREADSHEET', { title: args.title }, 'googlesheets');
        if (result.success) return { success: true, message: `Spreadsheet created: **${args.title}**`, data: result.data };
        return { success: false, message: result.error || 'Failed to create spreadsheet' };
    },
});

// ─── Notion ─────────────────────────────────────────────────────────

registerTool({
    name: 'create_notion_page',
    description: 'Create a Notion page via integration (NOT browser). Use for: "create notion page", "add to notion", "write in notion".',
    category: 'business',
    parameters: {
        title: { type: 'string', description: 'Page title', required: true },
        content: { type: 'string', description: 'Page content (markdown supported)', required: true },
        database_id: { type: 'string', description: 'Notion database ID to create page in', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('notion');
        if (err) return err;
        const result = await execComposio('NOTION_CREATE_PAGE', {
            title: args.title,
            content: args.content,
            ...(args.database_id && { databaseId: args.database_id }),
        }, 'notion');
        if (result.success) return { success: true, message: `Notion page created: **${args.title}**`, data: result.data };
        return { success: false, message: result.error || 'Failed to create Notion page' };
    },
});

registerTool({
    name: 'search_notion',
    description: 'Search Notion via integration (NOT browser). Use for: "search notion", "find in notion", "look up notion page".',
    category: 'business',
    parameters: {
        query: { type: 'string', description: 'Search query', required: true },
    },
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('notion');
        if (err) return err;
        const result = await execComposio('NOTION_SEARCH', { query: args.query }, 'notion');
        if (result.success) {
            const pages = result.data?.results || result.data || [];
            if (Array.isArray(pages) && pages.length > 0) {
                const list = pages.map((p: any) => `• **${p.title || p.properties?.Name?.title?.[0]?.plain_text || 'Untitled'}** (${p.object || 'page'})`).join('\n');
                return { success: true, message: `**Notion results (${pages.length}):**\n${list}`, data: pages };
            }
            return { success: true, message: `No Notion pages found for "${args.query}".` };
        }
        return { success: false, message: result.error || 'Notion search failed' };
    },
});

registerTool({
    name: 'update_notion_page',
    description: 'Update an existing Notion page content.',
    category: 'business',
    parameters: {
        page_id: { type: 'string', description: 'Notion page ID', required: true },
        content: { type: 'string', description: 'New content to append or replace', required: true },
    },
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('notion');
        if (err) return err;
        const result = await execComposio('NOTION_UPDATE_PAGE', {
            pageId: args.page_id,
            content: args.content,
        }, 'notion');
        if (result.success) return { success: true, message: `Notion page updated`, data: result.data };
        return { success: false, message: result.error || 'Failed to update Notion page' };
    },
});

// ─── GitHub ─────────────────────────────────────────────────────────

registerTool({
    name: 'list_github_repos',
    description: 'List GitHub repos via integration (NOT browser). Use for: "show my repos", "list repositories", "my github repos".',
    category: 'business',
    parameters: {
        org: { type: 'string', description: 'Organization name (omit for personal repos)', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('github');
        if (err) return err;
        const result = await execComposio('GITHUB_LIST_REPOS', {
            ...(args.org && { org: args.org }),
        }, 'github');
        if (result.success) {
            const repos = result.data?.repositories || result.data || [];
            if (Array.isArray(repos) && repos.length > 0) {
                const list = repos.map((r: any) => `• **${r.full_name || r.name}** — ${r.description || 'No description'} ${r.private ? '(private)' : ''}`).join('\n');
                return { success: true, message: `**Repositories (${repos.length}):**\n${list}`, data: repos };
            }
            return { success: true, message: 'No repositories found.', data: result.data };
        }
        return { success: false, message: result.error || 'Failed to list repos' };
    },
});

registerTool({
    name: 'create_github_issue',
    description: 'Create a GitHub issue via integration (NOT browser). Use for: "create issue", "file a bug", "open issue on github".',
    category: 'business',
    parameters: {
        repo: { type: 'string', description: 'Repository (owner/repo format)', required: true },
        title: { type: 'string', description: 'Issue title', required: true },
        body: { type: 'string', description: 'Issue description (markdown)', required: false },
        labels: { type: 'string', description: 'Comma-separated labels', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('github');
        if (err) return err;
        const [owner, repo] = args.repo.includes('/') ? args.repo.split('/') : ['', args.repo];
        const result = await execComposio('GITHUB_CREATE_ISSUE', {
            owner, repo,
            title: args.title,
            body: args.body || '',
            ...(args.labels && { labels: args.labels.split(',').map((l: string) => l.trim()) }),
        }, 'github');
        if (result.success) return { success: true, message: `Issue created in ${args.repo}: **${args.title}**`, data: result.data };
        return { success: false, message: result.error || 'Failed to create issue' };
    },
});

registerTool({
    name: 'list_github_prs',
    description: 'List GitHub PRs via integration (NOT browser). Use for: "show pull requests", "list PRs", "open PRs in repo".',
    category: 'business',
    parameters: {
        repo: { type: 'string', description: 'Repository (owner/repo format)', required: true },
        state: { type: 'string', description: 'Filter by state', enum: ['open', 'closed', 'all'], required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('github');
        if (err) return err;
        const [owner, repo] = args.repo.includes('/') ? args.repo.split('/') : ['', args.repo];
        const result = await execComposio('GITHUB_LIST_PULL_REQUESTS', {
            owner, repo,
            state: args.state || 'open',
        }, 'github');
        if (result.success) {
            const prs = result.data?.pull_requests || result.data || [];
            if (Array.isArray(prs) && prs.length > 0) {
                const list = prs.map((pr: any) => `• #${pr.number} **${pr.title}** by ${pr.user?.login || 'unknown'} (${pr.state})`).join('\n');
                return { success: true, message: `**Pull Requests (${prs.length}):**\n${list}`, data: prs };
            }
            return { success: true, message: 'No pull requests found.' };
        }
        return { success: false, message: result.error || 'Failed to list PRs' };
    },
});

registerTool({
    name: 'review_github_pr',
    description: 'Review a GitHub PR via integration (NOT browser). Use for: "review PR", "comment on pull request".',
    category: 'business',
    parameters: {
        repo: { type: 'string', description: 'Repository (owner/repo format)', required: true },
        pr_number: { type: 'string', description: 'Pull request number', required: true },
        comment: { type: 'string', description: 'Review comment text', required: true },
    },
    requiresConfirmation: true,
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('github');
        if (err) return err;
        const [owner, repo] = args.repo.includes('/') ? args.repo.split('/') : ['', args.repo];
        const result = await execComposio('GITHUB_CREATE_REVIEW_COMMENT', {
            owner, repo,
            pull_number: parseInt(args.pr_number, 10),
            body: args.comment,
        }, 'github');
        if (result.success) return { success: true, message: `Review comment added to PR #${args.pr_number}`, data: result.data };
        return { success: false, message: result.error || 'Failed to add review comment' };
    },
});

// ─── HubSpot CRM ────────────────────────────────────────────────────

registerTool({
    name: 'list_contacts',
    description: 'List CRM contacts via HubSpot integration (NOT browser). Use for: "show contacts", "list my contacts", "CRM contacts".',
    category: 'business',
    parameters: {
        count: { type: 'string', description: 'Number of contacts to fetch (default 20)', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('hubspot');
        if (err) return err;
        const result = await execComposio('HUBSPOT_LIST_CONTACTS', {
            limit: parseInt(args.count || '20', 10),
        }, 'hubspot');
        if (result.success) {
            const contacts = result.data?.contacts || result.data?.results || result.data || [];
            if (Array.isArray(contacts) && contacts.length > 0) {
                const list = contacts.map((c: any) => {
                    const name = `${c.properties?.firstname || c.firstName || ''} ${c.properties?.lastname || c.lastName || ''}`.trim() || 'Unknown';
                    const email = c.properties?.email || c.email || '';
                    return `• **${name}** — ${email}`;
                }).join('\n');
                return { success: true, message: `**Contacts (${contacts.length}):**\n${list}`, data: contacts };
            }
            return { success: true, message: 'No contacts found.' };
        }
        return { success: false, message: result.error || 'Failed to list contacts' };
    },
});

registerTool({
    name: 'create_contact',
    description: 'Create a new contact in HubSpot CRM.',
    category: 'business',
    parameters: {
        email: { type: 'string', description: 'Contact email address', required: true },
        first_name: { type: 'string', description: 'First name', required: false },
        last_name: { type: 'string', description: 'Last name', required: false },
        phone: { type: 'string', description: 'Phone number', required: false },
        company: { type: 'string', description: 'Company name', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('hubspot');
        if (err) return err;
        const result = await execComposio('HUBSPOT_CREATE_CONTACT', {
            email: args.email,
            ...(args.first_name && { firstname: args.first_name }),
            ...(args.last_name && { lastname: args.last_name }),
            ...(args.phone && { phone: args.phone }),
            ...(args.company && { company: args.company }),
        }, 'hubspot');
        if (result.success) return { success: true, message: `Contact created: **${args.first_name || ''} ${args.last_name || ''}** (${args.email})`, data: result.data };
        return { success: false, message: result.error || 'Failed to create contact' };
    },
});

registerTool({
    name: 'search_contacts',
    description: 'Search CRM contacts via HubSpot integration (NOT browser). Use for: "find contact", "search contacts", "look up person in CRM".',
    category: 'business',
    parameters: {
        query: { type: 'string', description: 'Search query', required: true },
    },
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('hubspot');
        if (err) return err;
        const result = await execComposio('HUBSPOT_SEARCH_CONTACTS', { query: args.query }, 'hubspot');
        if (result.success) {
            const contacts = result.data?.results || result.data || [];
            if (Array.isArray(contacts) && contacts.length > 0) {
                const list = contacts.map((c: any) => {
                    const name = `${c.properties?.firstname || ''} ${c.properties?.lastname || ''}`.trim() || 'Unknown';
                    return `• **${name}** — ${c.properties?.email || ''}`;
                }).join('\n');
                return { success: true, message: `**Search results (${contacts.length}):**\n${list}`, data: contacts };
            }
            return { success: true, message: `No contacts found for "${args.query}".` };
        }
        return { success: false, message: result.error || 'Contact search failed' };
    },
});

// ─── Google Calendar ────────────────────────────────────────────────

registerTool({
    name: 'list_calendar_events',
    description: 'List calendar events via integration (NOT browser). Use for: "what meetings do I have", "show my calendar", "upcoming events", "schedule today".',
    category: 'business',
    parameters: {
        count: { type: 'string', description: 'Number of events to fetch (default 10)', required: false },
        days_ahead: { type: 'string', description: 'Look ahead N days (default 7)', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('googlecalendar');
        if (err) return err;
        const daysAhead = parseInt(args.days_ahead || '7', 10);
        const timeMax = new Date(Date.now() + daysAhead * 86400000).toISOString();
        const result = await execComposio('GOOGLECALENDAR_LIST_EVENTS', {
            maxResults: parseInt(args.count || '10', 10),
            timeMin: new Date().toISOString(),
            timeMax,
        }, 'googlecalendar');
        if (result.success) {
            const events = result.data?.items || result.data || [];
            if (Array.isArray(events) && events.length > 0) {
                const list = events.map((e: any) => {
                    const start = e.start?.dateTime || e.start?.date || '';
                    return `• **${e.summary || 'Untitled'}** — ${start ? new Date(start).toLocaleString() : 'No date'}`;
                }).join('\n');
                return { success: true, message: `**Upcoming Events (${events.length}):**\n${list}`, data: events };
            }
            return { success: true, message: 'No upcoming events.' };
        }
        return { success: false, message: result.error || 'Failed to list events' };
    },
});

registerTool({
    name: 'create_calendar_event',
    description: 'Create a calendar event via integration (NOT browser). Use for: "schedule a meeting", "add event to calendar", "book time for X".',
    category: 'business',
    parameters: {
        title: { type: 'string', description: 'Event title', required: true },
        start: { type: 'string', description: 'Start time in ISO 8601 (e.g. 2026-04-25T14:00:00)', required: true },
        end: { type: 'string', description: 'End time in ISO 8601', required: true },
        description: { type: 'string', description: 'Event description', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        const err = requireApp('googlecalendar');
        if (err) return err;
        const result = await execComposio('GOOGLECALENDAR_CREATE_EVENT', {
            summary: args.title,
            start: { dateTime: args.start },
            end: { dateTime: args.end },
            ...(args.description && { description: args.description }),
        }, 'googlecalendar');
        if (result.success) return { success: true, message: `Event created: **${args.title}** at ${new Date(args.start).toLocaleString()}`, data: result.data };
        return { success: false, message: result.error || 'Failed to create event' };
    },
});
