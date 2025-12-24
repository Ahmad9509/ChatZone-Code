'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { SidebarToggleIcon, PlusIcon, ConversationIcon, GearIcon, LogoutIcon } from '@/components/icons';

// Using store types since this component receives data from the store
interface User {
  _id: string;
  email: string;
  name: string;
  username: string;
  tier: string;
}

interface Conversation {
  _id: string;
  title: string;
  starred: boolean;
  archived: boolean;
  updatedAt: string;
  lastMessageAt: string;
}

interface Project {
  _id: string;
  name: string;
}

interface SidebarProps {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  user: User;
  conversations: Conversation[];
  currentConversation: Conversation | null;
  setCurrentConversation: (conv: Conversation) => void;
  handleNewChat: () => void;
  handleLogout: () => void;
  conversationMenuOpen: string | null;
  setConversationMenuOpen: (id: string | null) => void;
  showAddToProjectMenu: string | null;
  setShowAddToProjectMenu: (id: string | null) => void;
  submenuPosition: { top: number; left: number } | null;
  setSubmenuPosition: (pos: { top: number; left: number } | null) => void;
  projects: Project[];
  handleAddToProject: (conversationId: string, projectId: string) => void;
  getConversation: (id: string) => Promise<void>;
}

export const Sidebar = ({
  sidebarCollapsed,
  toggleSidebar,
  user,
  conversations,
  currentConversation,
  setCurrentConversation,
  handleNewChat,
  handleLogout,
  conversationMenuOpen,
  setConversationMenuOpen,
  showAddToProjectMenu,
  setShowAddToProjectMenu,
  submenuPosition,
  setSubmenuPosition,
  projects,
  handleAddToProject,
  getConversation,
}: SidebarProps) => {
  const router = useRouter();

  return (
    <div
      className={`flex flex-col bg-background transition-all duration-200 ease-out ${
        sidebarCollapsed ? 'w-20' : 'w-[260px]'
      }`}
    >
      {/* Header with Logo */}
      <div className="flex items-center px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3 flex-1">
          {/* Neumorphic Logo Circle - Clickable to expand when collapsed */}
          <button
            onClick={() => {
              if (sidebarCollapsed) {
                toggleSidebar();
              }
            }}
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-surface soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed focus:outline-none focus:ring-2 focus:ring-accent overflow-hidden ${
              sidebarCollapsed ? 'cursor-pointer' : 'cursor-default'
            }`}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : undefined}
            type="button"
          >
            <Image
              src="/logo.jpeg"
              alt="ChatZone Logo"
              width={48}
              height={48}
              className="w-full h-full object-cover rounded-full"
            />
          </button>
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold text-text-primary">ChatZone</div>
              <div className="text-[10px] uppercase tracking-wider text-text-muted">{user.tier.toUpperCase()} plan</div>
            </div>
          )}
        </div>
        {/* Toggle Button - Only show when expanded */}
        {!sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Collapse sidebar"
            type="button"
          >
            <SidebarToggleIcon className="h-4 w-4 text-text-secondary" />
          </button>
        )}
      </div>

      {/* Projects Button */}
      <div className={`px-4 py-2 ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
        <button
          onClick={() => router.push('/projects')}
          className={`flex items-center rounded-xl border-0 bg-surface text-text-primary soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed focus:outline-none focus:ring-2 focus:ring-accent ${
            sidebarCollapsed ? 'h-10 w-10 justify-center' : 'w-full px-4 py-3 text-sm font-semibold'
          }`}
        >
          {sidebarCollapsed ? (
            <svg className="h-4 w-4" viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M2 4a2 2 0 0 1 2-2h4.586a1 1 0 0 1 .707.293l1.414 1.414A1 1 0 0 0 11.414 4H16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            '📂 Projects'
          )}
        </button>
      </div>

      {/* Designs Button - Hidden */}
      {/* <div className={`px-4 py-2 ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
        <button
          onClick={() => router.push('/designs')}
          className={`flex items-center rounded-xl border-0 bg-surface text-text-primary soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed focus:outline-none focus:ring-2 focus:ring-accent ${
            sidebarCollapsed ? 'h-10 w-10 justify-center' : 'w-full px-4 py-3 text-sm font-semibold'
          }`}
        >
          {sidebarCollapsed ? (
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M2 8h16M8 2v16" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          ) : (
            '🎨 Designs'
          )}
        </button>
      </div> */}

      {/* New Chat Button */}
      <div className={`px-4 py-4 ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
        <button
          onClick={handleNewChat}
          className={`flex items-center justify-center rounded-2xl bg-surface text-accent soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
            sidebarCollapsed ? 'h-12 w-12' : 'w-full px-4 py-3.5 text-sm font-semibold'
          }`}
        >
          {sidebarCollapsed ? <PlusIcon className="h-5 w-5" /> : '+ New chat'}
        </button>
      </div>

      {/* Conversations List */}
      {!sidebarCollapsed && (
        <div className="flex-1 overflow-y-auto pb-4 px-4">
          <div className="px-3 mb-3">
            <div className="text-[10px] uppercase tracking-widest text-text-muted font-medium">RECENT</div>
          </div>
          {conversations.map((conv) => (
          <div key={conv._id} className="relative group mb-2">
            <button
              onClick={() => getConversation(conv._id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm neumorphic-transition ${
                currentConversation?._id === conv._id
                  ? 'bg-surface-subtle soft-elevated border-l-[3px] border-l-accent'
                  : 'bg-surface soft-elevated hover:soft-hover'
              } ${sidebarCollapsed ? 'justify-center px-2 py-2' : ''}`}
            >
              <ConversationIcon className={`h-4 w-4 text-text-secondary flex-shrink-0`} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-text-primary">{conv.title}</div>
                <div className="text-xs text-text-secondary mt-0.5">
                  Updated {new Date(conv.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConversationMenuOpen(conversationMenuOpen === conv._id ? null : conv._id);
              }}
              className="absolute right-2 top-3 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-surface-subtle rounded-lg transition-opacity neumorphic-transition"
              title="More options"
            >
              <span className="text-text-secondary text-lg">⋮</span>
            </button>
            
            {conversationMenuOpen === conv._id && (
              <div className="absolute right-2 top-12 w-48 rounded-xl border-0 bg-surface soft-elevated z-20">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setSubmenuPosition({
                      top: rect.top,
                      left: rect.right + 8,
                    });
                    setShowAddToProjectMenu(showAddToProjectMenu === conv._id ? null : conv._id);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-surface-subtle text-text-primary flex items-center justify-between rounded-lg neumorphic-transition"
                >
                  <span>Add to project</span>
                  <span className="text-text-secondary">›</span>
                </button>
                
                {showAddToProjectMenu === conv._id && submenuPosition && (
                  <div 
                    className="fixed w-48 rounded-xl border-0 bg-surface soft-elevated z-50" 
                    style={{ 
                      top: `${submenuPosition.top}px`, 
                      left: `${submenuPosition.left}px` 
                    }}
                  >
                    {projects.length > 0 ? (
                      projects.map((project) => (
                        <button
                          key={project._id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToProject(conv._id, project._id);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-surface-subtle text-text-primary rounded-lg neumorphic-transition"
                        >
                          {project.name}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-2.5 text-sm text-text-secondary">No projects available</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          ))}
        </div>
      )}

      {/* User Profile Footer - Hide when collapsed */}
      {!sidebarCollapsed && (
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-surface soft-elevated text-sm font-semibold text-accent">
              {user.name[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-text-primary">{user.name}</div>
              <div className="truncate text-xs text-text-secondary">{user.email}</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => router.push('/settings')}
              className="rounded-xl border-0 bg-surface text-xs font-medium text-text-primary soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed focus:outline-none focus:ring-2 focus:ring-accent flex-1 px-3 py-2"
              title="Settings"
            >
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="rounded-xl border-0 bg-surface text-xs text-text-secondary soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed focus:outline-none focus:ring-2 focus:ring-accent px-3 py-2"
              title="Logout"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
