import '@testing-library/jest-dom/extend-expect';
import { fireEvent, render, screen } from '@testing-library/react';
import ToolCard from '../ToolCard';
import type { AgentItem } from '../items/types';

jest.mock('~/hooks', () => ({
  useLocalize:
    () =>
    (key: string, options?: Record<string, unknown>): string => {
      if (!options) return key;
      const parts = Object.entries(options).map(([name, value]) => `${name}=${String(value)}`);
      return `${key}[${parts.join(',')}]`;
    },
}));

const skill: AgentItem = {
  kind: 'skill',
  id: 's1',
  name: 'Reviewer',
  description: 'Review PRs',
  iconKey: 'skill',
  skill: { _id: 's1', name: 'Reviewer' } as never,
};

describe('ToolCard', () => {
  test('renders item name and description', () => {
    render(<ToolCard item={skill} selected={false} onToggle={jest.fn()} />);
    expect(screen.getByText('Reviewer')).toBeInTheDocument();
    expect(screen.getByText('Review PRs')).toBeInTheDocument();
  });

  test('clicking the card invokes onToggle with the item', () => {
    const onToggle = jest.fn();
    render(<ToolCard item={skill} selected={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /Reviewer/ }));
    expect(onToggle).toHaveBeenCalledWith(skill);
  });

  test('selected cards expose aria-pressed=true', () => {
    render(<ToolCard item={skill} selected onToggle={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Reviewer/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('renders an Official pill for built-ins', () => {
    const builtin: AgentItem = {
      kind: 'builtin',
      id: 'execute_code',
      name: 'Code Interpreter',
      description: 'Run Python',
      iconKey: 'execute_code',
    };
    render(<ToolCard item={builtin} selected={false} onToggle={jest.fn()} />);
    expect(screen.getByText('com_ui_tools_native')).toBeInTheDocument();
  });

  test('renders MCP tool-count pill when toolCount > 0', () => {
    const mcp: AgentItem = {
      kind: 'mcp',
      id: 'everything',
      name: 'Everything',
      description: '',
      iconKey: 'mcp',
      server: { serverName: 'everything', isConfigured: true, tools: [] } as never,
      toolCount: 14,
    };
    render(<ToolCard item={mcp} selected={false} onToggle={jest.fn()} />);
    expect(screen.getByText('com_ui_tools_count[count=14]')).toBeInTheDocument();
  });
});
