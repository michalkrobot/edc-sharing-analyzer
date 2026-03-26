window.EDC_AUTH_API_BASE = window.EDC_AUTH_API_BASE || (
	["localhost", "127.0.0.1"].includes(window.location.hostname)
		? "http://localhost:8787/api"
		: "/api"
);
window.EDC_AUTH_REQUIRED = true;
window.EDC_AUTH_APP_NAME = "EDC CSV TOOL";
