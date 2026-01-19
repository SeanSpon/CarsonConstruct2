import { memo, type ReactNode } from 'react';

export interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

function PageLayout({ children, className = '', noPadding = false }: PageLayoutProps) {
  return (
    <div className={`min-h-full bg-sz-bg ${noPadding ? '' : 'p-6'} ${className}`}>
      {children}
    </div>
  );
}

export default memo(PageLayout);

// Centered page layout for home, onboarding, etc.
export interface CenteredPageProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

export const CenteredPage = memo(function CenteredPage({ 
  children, 
  className = '',
  maxWidth = '2xl'
}: CenteredPageProps) {
  return (
    <div className={`min-h-full flex flex-col items-center justify-center p-8 bg-sz-bg ${className}`}>
      <div className={`w-full ${maxWidthClasses[maxWidth]}`}>
        {children}
      </div>
    </div>
  );
});

// Three-panel editor layout
export interface EditorLayoutProps {
  leftPanel?: ReactNode;
  centerPanel: ReactNode;
  rightPanel?: ReactNode;
  bottomPanel?: ReactNode;
  leftPanelWidth?: string;
  rightPanelWidth?: string;
  showLeftPanel?: boolean;
  showRightPanel?: boolean;
  className?: string;
}

export const EditorLayout = memo(function EditorLayout({
  leftPanel,
  centerPanel,
  rightPanel,
  bottomPanel,
  leftPanelWidth = 'w-64',
  rightPanelWidth = 'w-80',
  showLeftPanel = true,
  showRightPanel = true,
  className = '',
}: EditorLayoutProps) {
  return (
    <div className={`h-full flex flex-col bg-sz-bg ${className}`}>
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        {showLeftPanel && leftPanel && (
          <div className={`${leftPanelWidth} flex-shrink-0 border-r border-sz-border bg-sz-bg-secondary overflow-y-auto`}>
            {leftPanel}
          </div>
        )}

        {/* Center Panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {centerPanel}
          </div>
          
          {/* Bottom Panel (Timeline/Clip List) */}
          {bottomPanel && (
            <div className="border-t border-sz-border bg-sz-bg-secondary">
              {bottomPanel}
            </div>
          )}
        </div>

        {/* Right Panel */}
        {showRightPanel && rightPanel && (
          <div className={`${rightPanelWidth} flex-shrink-0 border-l border-sz-border bg-sz-bg-secondary overflow-y-auto`}>
            {rightPanel}
          </div>
        )}
      </div>
    </div>
  );
});
