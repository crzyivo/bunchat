import Html from "@kitajs/html";

interface RegisterPageProps {
    error?: string;
}

export default function RegisterPage({ error }: RegisterPageProps) {
    return (
        <div class="auth-container">
            <div class="auth-box">
                <div class="auth-header">
                    <h1 class="logo">BunChat</h1>
                    <p class="tagline">Join the conversation</p>
                </div>

                {error && <div class="error-message">{error}</div>}

                <form method="POST" action="/register" class="auth-form">
                    <div class="form-group">
                        <label for="username">Username</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            required
                            minlength={3}
                            maxlength={20}
                            autocomplete="username"
                            placeholder="Choose a username (3-20 chars)"
                        />
                    </div>

                    <div class="form-group">
                        <label for="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            required
                            minlength={6}
                            autocomplete="new-password"
                            placeholder="Choose a password (min 6 chars)"
                        />
                    </div>

                    <div class="form-group">
                        <label for="confirmPassword">Confirm Password</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            required
                            minlength={6}
                            autocomplete="new-password"
                            placeholder="Confirm your password"
                        />
                    </div>

                    <button type="submit" class="btn btn-primary">
                        Create Account
                    </button>
                </form>

                <div class="auth-footer">
                    <p>
                        Already have an account? <a href="/login">Login here</a>
                    </p>
                </div>
            </div>
        </div>
    );
}
