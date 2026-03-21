CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash CHAR(60) NOT NULL,
    name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
CREATE TABLE workspaces (
    id INT PRIMARY KEY AUTO_INCREMENT,
    owner_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_workspaces_owner
    	FOREIGN KEY (owner_id)
    	REFERENCES users(id)
    	ON DELETE CASCADE
    	ON UPDATE CASCADE
    );

CREATE TABLE workspace_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    workspace_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('admin','editor','viewer') NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_workspace_members_workspace
        FOREIGN KEY (workspace_id)
        REFERENCES workspaces(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_workspace_members_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    UNIQUE (workspace_id, user_id)
);

CREATE TABLE pages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    workspace_id INT NOT NULL,
    owner_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pages_workspace
    	FOREIGN KEY (workspace_id)
    	REFERENCES workspaces(id)
    	ON DELETE CASCADE
    	ON UPDATE CASCADE,
    CONSTRAINT fk_pages_owner
    	FOREIGN KEY (owner_id)
    	REFERENCES users(id)
    	ON DELETE SET NULL
    	ON UPDATE CASCADE
    );
    
CREATE TABLE page_shares (
    id INT PRIMARY KEY AUTO_INCREMENT,
    page_id INT NOT NULL,
    user_id INT NOT NULL,
    permission ENUM('read','edit') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_page_shares_page
    	FOREIGN KEY (page_id)
    	REFERENCES pages(id)
    	ON DELETE CASCADE
    	ON UPDATE CASCADE,
    CONSTRAINT fk_page_shares_user
    	FOREIGN KEY (user_id)
    	REFERENCES users(id)
    	ON DELETE CASCADE
    	ON UPDATE CASCADE,
    UNIQUE (page_id, user_id)
    );
    
CREATE TABLE comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    page_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_comments_page
    	FOREIGN KEY (page_id)
    	REFERENCES pages(id)
    	ON DELETE CASCADE
    	ON UPDATE CASCADE,
    CONSTRAINT fk_comments_user
    	FOREIGN KEY (user_id)
    	REFERENCES users(id)
    	ON DELETE SET NULL
    	ON UPDATE CASCADE
    );

CREATE INDEX idx_users_email ON users(email);

CREATE INDEX idx_pages_workspace_id ON pages(workspace_id);

CREATE INDEX idx_comments_page_id ON comments(page_id);

CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);

CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);