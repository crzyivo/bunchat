import Html from "@kitajs/html";
import type { User } from "../db";

interface ProfilePageProps {
    user: User;
    error?: string;
    success?: string;
    sessionId?: string;
}

const DEFAULT_AVATARS = [
    "/avatars/default1.svg",
    "/avatars/default2.svg",
    "/avatars/default3.svg",
    "/avatars/default4.svg",
    "/avatars/default5.svg",
];

export default function ProfilePage({ user, error, success, sessionId }: ProfilePageProps) {
    return (
        <div class="profile-container">
            <header class="profile-header">
                <a href="/" class="back-link">&larr; Back to Dashboard</a>
                <h1>Profile Settings</h1>
            </header>

            <main class="profile-main">
                {error && <div class="error-message">{error}</div>}
                {success && <div class="success-message">{success}</div>}

                <section class="profile-section">
                    <h2>User Info</h2>
                    <div class="user-display">
                        <img src={user.avatar_url} alt={user.username} class="avatar-large" />
                        <div class="user-details">
                            <p class="username-display">{user.username}</p>
                            <p class="user-note">Username cannot be changed</p>
                        </div>
                    </div>
                </section>

                <section class="profile-section">
                    <h2>Change Avatar</h2>
                    <div id="avatar-feedback" class="hidden"></div>

                    <div class="avatar-section-group">
                        <h3 class="avatar-section-title">Default Avatars</h3>
                        <form id="avatar-form" class="avatar-form">
                            <div class="avatar-grid" id="avatar-grid">
                                {DEFAULT_AVATARS.map((avatar, index) => (
                                    <label
                                        class={`avatar-option ${user.avatar_url === avatar ? "selected" : ""}`}
                                        data-avatar={avatar}
                                    >
                                        <input
                                            type="radio"
                                            name="avatar"
                                            value={avatar}
                                            checked={user.avatar_url === avatar}
                                        />
                                        <img src={avatar} alt={`Avatar option ${index + 1}`} />
                                    </label>
                                ))}
                            </div>
                            <button type="submit" class="btn btn-primary" id="avatar-submit-btn">Update Avatar</button>
                        </form>
                    </div>

                    <div class="avatar-section-group">
                        <h3 class="avatar-section-title">Upload Custom Avatar</h3>
                        <p class="upload-note">Max 5MB. Supported formats: JPG, PNG, GIF, WebP</p>
                        <form id="upload-avatar-form" class="upload-avatar-form">
                            <div class="upload-container">
                                <input
                                    type="file"
                                    id="avatar-file"
                                    name="avatar"
                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                    class="file-input"
                                />
                                <label for="avatar-file" class="file-label">
                                    <span id="file-name">Choose file...</span>
                                </label>
                                <button type="submit" class="btn btn-primary" id="upload-btn">Upload</button>
                            </div>
                        </form>
                    </div>
                </section>

                <section class="profile-section">
                    <h2>Change Password</h2>
                    <form method="POST" action="/profile/password" class="password-form">
                        <div class="form-group">
                            <label for="currentPassword">Current Password</label>
                            <input
                                type="password"
                                id="currentPassword"
                                name="currentPassword"
                                required
                                autocomplete="current-password"
                            />
                        </div>

                        <div class="form-group">
                            <label for="newPassword">New Password</label>
                            <input
                                type="password"
                                id="newPassword"
                                name="newPassword"
                                required
                                minlength={6}
                                autocomplete="new-password"
                            />
                        </div>

                        <div class="form-group">
                            <label for="confirmPassword">Confirm New Password</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                name="confirmPassword"
                                required
                                minlength={6}
                                autocomplete="new-password"
                            />
                        </div>

                        <button type="submit" class="btn btn-primary">Change Password</button>
                    </form>
                </section>
            </main>

            <script>{`
                (function() {
                    const avatarForm = document.getElementById('avatar-form');
                    const avatarGrid = document.getElementById('avatar-grid');
                    const avatarFeedback = document.getElementById('avatar-feedback');
                    const avatarSubmitBtn = document.getElementById('avatar-submit-btn');
                    const currentAvatarImg = document.querySelector('.avatar-large');
                    const uploadForm = document.getElementById('upload-avatar-form');
                    const fileInput = document.getElementById('avatar-file');
                    const fileName = document.getElementById('file-name');
                    const uploadBtn = document.getElementById('upload-btn');

                    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
                    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                    
                    function showFeedback(message, isError) {
                        avatarFeedback.textContent = message;
                        avatarFeedback.className = isError ? 'error-message' : 'success-message';
                    }

                    // Handle avatar option clicks
                    avatarGrid.addEventListener('click', function(e) {
                        const label = e.target.closest('.avatar-option');
                        if (label) {
                            avatarGrid.querySelectorAll('.avatar-option').forEach(opt => {
                                opt.classList.remove('selected');
                            });
                            label.classList.add('selected');
                            const radio = label.querySelector('input[type="radio"]');
                            if (radio) radio.checked = true;
                        }
                    });

                    // Handle default avatar selection
                    avatarForm.addEventListener('submit', async function(e) {
                        e.preventDefault();
                        
                        const selectedRadio = avatarForm.querySelector('input[name="avatar"]:checked');
                        if (!selectedRadio) {
                            showFeedback('Please select an avatar', true);
                            return;
                        }

                        const avatar = selectedRadio.value;
                        avatarSubmitBtn.disabled = true;
                        avatarSubmitBtn.textContent = 'Updating...';

                        try {
                            const response = await fetch('/api/profile/avatar', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ avatar })
                            });
                            const data = await response.json();
                            
                            if (data.success) {
                                showFeedback(data.message, false);
                                if (currentAvatarImg) {
                                    currentAvatarImg.src = data.avatar_url;
                                }
                            } else {
                                showFeedback(data.error || 'Failed to update avatar', true);
                            }
                        } catch (err) {
                            showFeedback('Network error. Please try again.', true);
                        }
                        
                        avatarSubmitBtn.disabled = false;
                        avatarSubmitBtn.textContent = 'Update Avatar';
                    });

                    // Handle file selection
                    fileInput.addEventListener('change', function() {
                        if (this.files && this.files[0]) {
                            fileName.textContent = this.files[0].name;
                        } else {
                            fileName.textContent = 'Choose file...';
                        }
                    });

                    // Handle file upload
                    uploadForm.addEventListener('submit', async function(e) {
                        e.preventDefault();
                        
                        const file = fileInput.files[0];
                        if (!file) {
                            showFeedback('Please select a file', true);
                            return;
                        }

                        if (!ALLOWED_TYPES.includes(file.type)) {
                            showFeedback('Invalid file type. Use JPG, PNG, GIF, or WebP.', true);
                            return;
                        }

                        if (file.size > MAX_FILE_SIZE) {
                            showFeedback('File too large. Maximum size is 5MB.', true);
                            return;
                        }

                        uploadBtn.disabled = true;
                        uploadBtn.textContent = 'Uploading...';

                        try {
                            const formData = new FormData();
                            formData.append('avatar', file);

                            const response = await fetch('/api/profile/avatar/upload', {
                                method: 'POST',
                                body: formData
                            });
                            const data = await response.json();
                            
                            if (data.success) {
                                showFeedback(data.message, false);
                                if (currentAvatarImg) {
                                    currentAvatarImg.src = data.avatar_url + '?t=' + Date.now();
                                }
                                fileInput.value = '';
                                fileName.textContent = 'Choose file...';
                            } else {
                                showFeedback(data.error || 'Failed to upload avatar', true);
                            }
                        } catch (err) {
                            showFeedback('Network error. Please try again.', true);
                        }
                        
                        uploadBtn.disabled = false;
                        uploadBtn.textContent = 'Upload';
                    });
                })();
            `}</script>
        </div>
    );
}
