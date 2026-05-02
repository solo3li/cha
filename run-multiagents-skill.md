# Skill: Run Multiagents

This is a custom Gemini CLI skill to facilitate orchestrating multiple AI agents (e.g., a backend specialist and a frontend specialist) to work concurrently or sequentially on the Messenger Clone project.

<description>
Facilitates multi-agent orchestration for complex features, allowing you to deploy specialized sub-agents to handle frontend, backend, or database tasks concurrently.
</description>

<instructions>
1. When asked to use multi-agents, analyze the requested feature.
2. Break down the feature into isolated domain tasks (e.g., Database Migrations, SignalR logic, CSS styling).
3. Use the `invoke_agent` tool to spawn sub-agents (like `generalist` or a custom sub-agent) with a highly specific prompt for each isolated task.
4. If tasks are independent, run the `invoke_agent` commands in parallel. If dependent, use `wait_for_previous=true`.
5. Once all agents return their results, review the combined changes to ensure architectural harmony.
</instructions>
