import Html from "@kitajs/html";

interface LoginPageProps {
    error?: string;
}

export default function LoginPage({ error }: LoginPageProps) {
    return (
        <div class="auth-container">
            <div class="auth-box">
                <div class="auth-header">
                    <h1 class="logo">BunChat</h1>
                    <p class="tagline">IRC-style chat for the modern web</p>
                </div>

                {error && <div class="error-message">{error}</div>}

                <form method="POST" action="/login" class="auth-form">
                    <div class="form-group">
                        <label for="username">Username</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            required
                            autocomplete="username"
                            placeholder="Enter your username"
                        />
                    </div>

                    <div class="form-group">
                        <label for="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            required
                            autocomplete="current-password"
                            placeholder="Enter your password"
                        />
                    </div>

                    <button type="submit" class="btn btn-primary">
                        Login
                    </button>
                </form>

                <div class="auth-footer">
                    <p>
                        Don't have an account? <a href="/register">Register here</a>
                    </p>
                </div>
            </div>
        </div>
    );
}
