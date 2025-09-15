// Shared global types for the application

export interface RepoMetadata {
  analysisId: string;
  repository: string;
  timestamp: number;
  persistentPath: string;
  filesCount: number;
  totalIssues: number;
  criticalIssues: number;
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
  type: string;
}

// Global type declarations
declare global {
  var sessionContexts: Map<string, any>;
  var repositoryCache: Map<string, {
    metadata: RepoMetadata;
    files: Map<string, FileContent>;
    timestamp: number;
  }>;
}

export {}; // Make this a module
