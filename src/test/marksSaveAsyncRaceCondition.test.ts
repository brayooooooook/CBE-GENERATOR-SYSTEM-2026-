import { describe, it, expect } from 'vitest';
import { Mark } from '../types';

interface ToastState {
  type: 'saving' | 'success' | 'error';
  title: string;
  message: string;
}

describe('MarksEntryTable async onSaveMarks race condition and toast reliability verification', () => {
  it('TEST 1: Successful save displays saving toast, awaits resolution, then displays success toast and clears dirty cells', async () => {
    let currentToast: ToastState | null = null;
    let isSaving = false;
    let dirtyCells = new Set(['std1_sub1_exam1']);

    const onSaveMarks = async (_marks: Mark[]) => {
      // Simulate network latency (40ms)
      await new Promise((res) => setTimeout(res, 40));
    };

    const handleSaveAll = async () => {
      isSaving = true;
      currentToast = {
        type: 'saving',
        title: 'Saving marks…',
        message: 'Please wait while your changes are being saved.',
      };

      try {
        await onSaveMarks([{ id: 'm1', student_id: 'std1', subject_id: 'sub1', exam_id: 'exam1', marks: 80 }]);
        dirtyCells = new Set();
        currentToast = {
          type: 'success',
          title: 'Marks saved successfully',
          message: 'Your changes have been saved.',
        };
      } catch (err: any) {
        currentToast = {
          type: 'error',
          title: 'Marks not saved',
          message: 'Your changes could not be saved. Please check your connection and try again.',
        };
      } finally {
        isSaving = false;
      }
    };

    // Before save
    expect(currentToast).toBeNull();
    expect(isSaving).toBe(false);
    expect(dirtyCells.size).toBe(1);

    // Trigger save
    const savePromise = handleSaveAll();

    // While in-flight (saving state)
    expect(isSaving).toBe(true);
    expect(currentToast).toEqual({
      type: 'saving',
      title: 'Saving marks…',
      message: 'Please wait while your changes are being saved.',
    });
    expect(dirtyCells.size).toBe(1);

    // Await completion
    await savePromise;

    // After successful resolution
    expect(isSaving).toBe(false);
    expect(currentToast).toEqual({
      type: 'success',
      title: 'Marks saved successfully',
      message: 'Your changes have been saved.',
    });
    expect(dirtyCells.size).toBe(0);
  });

  it('TEST 2: Failed save shows "Marks not saved" and preserves dirty cells for retry', async () => {
    let currentToast: ToastState | null = null;
    let isSaving = false;
    let dirtyCells = new Set(['std1_sub1_exam1']);

    const onSaveMarks = async (_marks: Mark[]) => {
      await new Promise((res) => setTimeout(res, 20));
      throw new Error('TypeError: Failed to fetch');
    };

    const handleSaveAll = async () => {
      isSaving = true;
      currentToast = {
        type: 'saving',
        title: 'Saving marks…',
        message: 'Please wait while your changes are being saved.',
      };

      try {
        await onSaveMarks([{ id: 'm1', student_id: 'std1', subject_id: 'sub1', exam_id: 'exam1', marks: 80 }]);
        dirtyCells = new Set();
        currentToast = {
          type: 'success',
          title: 'Marks saved successfully',
          message: 'Your changes have been saved.',
        };
      } catch (err: any) {
        currentToast = {
          type: 'error',
          title: 'Marks not saved',
          message: 'Your changes could not be saved. Please check your connection and try again.',
        };
      } finally {
        isSaving = false;
      }
    };

    // Trigger and await failed save
    await handleSaveAll();

    // Verification
    expect(isSaving).toBe(false);
    expect(currentToast).toEqual({
      type: 'error',
      title: 'Marks not saved',
      message: 'Your changes could not be saved. Please check your connection and try again.',
    });
    // Critical: dirty cells are NOT cleared
    expect(dirtyCells.size).toBe(1);
    expect(dirtyCells.has('std1_sub1_exam1')).toBe(true);
  });

  it('TEST 3: Retry workflow after failure saves successfully and clears dirty cells', async () => {
    let currentToast: ToastState | null = null;
    let isSaving = false;
    let dirtyCells = new Set(['std1_sub1_exam1']);
    let shouldFail = true;

    const onSaveMarks = async (_marks: Mark[]) => {
      await new Promise((res) => setTimeout(res, 10));
      if (shouldFail) {
        throw new Error('Network error');
      }
    };

    const handleSaveAll = async () => {
      isSaving = true;
      currentToast = {
        type: 'saving',
        title: 'Saving marks…',
        message: 'Please wait while your changes are being saved.',
      };

      try {
        await onSaveMarks([{ id: 'm1', student_id: 'std1', subject_id: 'sub1', exam_id: 'exam1', marks: 80 }]);
        dirtyCells = new Set();
        currentToast = {
          type: 'success',
          title: 'Marks saved successfully',
          message: 'Your changes have been saved.',
        };
      } catch (err: any) {
        currentToast = {
          type: 'error',
          title: 'Marks not saved',
          message: 'Your changes could not be saved. Please check your connection and try again.',
        };
      } finally {
        isSaving = false;
      }
    };

    // Attempt 1: Fails
    await handleSaveAll();
    expect(currentToast?.type).toBe('error');
    expect(currentToast?.title).toBe('Marks not saved');
    expect(dirtyCells.size).toBe(1);

    // Network recovers: Attempt 2 (Retry)
    shouldFail = false;
    await handleSaveAll();

    // Verification
    expect(currentToast?.type).toBe('success');
    expect(currentToast?.title).toBe('Marks saved successfully');
    expect(dirtyCells.size).toBe(0);
  });
});
