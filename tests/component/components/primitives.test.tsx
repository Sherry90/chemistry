// Phase 10 §8.3 P1/P2/P4/P5/P6/P8 — primitive ARIA/포커스/키보드 회귀.
// axe 자동 검증은 Phase 15 — 본 테스트는 ARIA 속성 존재+값만.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Switch } from '@/components/Switch';
import { Slider } from '@/components/Slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/Tabs';
import { Dialog, DialogContent } from '@/components/Dialog';

describe('Button (P1)', () => {
  it('loading → aria-busy + disabled; type 기본 button', () => {
    render(
      <Button loading variant="danger" size="lg">
        Go
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('asChild → Slot 컴포지션 (button 아닌 a)', () => {
    render(
      <Button asChild>
        <a href="/x">link</a>
      </Button>,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/x');
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Input (P8)', () => {
  it('invalid → aria-invalid; label htmlFor 연결', () => {
    render(
      <>
        <label htmlFor="f1">Name</label>
        <Input id="f1" invalid aria-describedby="e1" />
        <span id="e1">err</span>
      </>,
    );
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'e1');
  });
});

describe('Switch (P6)', () => {
  it('role=switch, 클릭 시 aria-checked 토글', () => {
    function C() {
      return <Switch defaultChecked={false} aria-label="cvd" />;
    }
    render(<C />);
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Slider (P5)', () => {
  it('role=slider, aria-value* 노출', () => {
    render(<Slider defaultValue={[40]} min={0} max={100} aria-label="temp" />);
    const s = screen.getByRole('slider');
    expect(s).toHaveAttribute('aria-valuenow', '40');
    expect(s).toHaveAttribute('aria-valuemin', '0');
    expect(s).toHaveAttribute('aria-valuemax', '100');
  });
});

describe('Tabs (P4)', () => {
  it('role=tab/tabpanel + aria-selected 토글', async () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">PA</TabsContent>
        <TabsContent value="b">PB</TabsContent>
      </Tabs>,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    // Radix Tabs(자동 활성) 는 focus 시 선택 — userEvent.click 이 focus 동반.
    await userEvent.click(tabs[1]!);
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('PB')).toBeInTheDocument();
  });
});

describe('Dialog (P2)', () => {
  it('open → role=dialog + title(i18n key); Esc → onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent i18nTitleKey="dlg.title">body</DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('dlg.title')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
