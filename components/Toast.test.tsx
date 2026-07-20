// Toast 컴포넌트의 노출 및 타이머 작동 기능을 검증하는 단위 테스트 파일.

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Toast from './Toast';

describe('Toast Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('isVisible이 false일 때 렌더링되지 않아야 합니다.', () => {
    const { container } = render(
      <Toast message="테스트 메시지" isVisible={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('isVisible이 true일 때 메시지가 올바르게 노출되어야 합니다.', () => {
    render(<Toast message="성공 메시지" isVisible={true} onClose={vi.fn()} />);
    expect(screen.getByText('성공 메시지')).toBeInTheDocument();
  });

  it('3초가 지나면 onClose 콜백 함수가 호출되어야 합니다.', () => {
    const handleClose = vi.fn();
    render(<Toast message="타이머 테스트" isVisible={true} onClose={handleClose} />);

    // 3초 경과 시뮬레이션
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
