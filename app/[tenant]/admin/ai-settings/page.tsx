'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface CustomItem {
  id: string;
  name: string;
  content: string;
  order: number;
}

interface AutoAppendRule {
  id: string;
  name: string;
  keywords: string[];
  message: string;
  position: 'end' | 'start';
  is_active: boolean;
  order: number;
}

interface PeriodRule {
  id: string;
  name: string;
  message: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  order: number;
}

interface DepartmentSection {
  id: string;
  name: string;
  keywords: string[];
  content: string;
  additional_instructions: string;
  order: number;
}

interface PromptParts {
  school_info: string;
  access: string;
  unable_response: string;
  closing_message: string;
  additional_instructions: string;
  custom_items: CustomItem[];
  auto_append_rules: AutoAppendRule[];
  period_rules: PeriodRule[];
  department_sections: DepartmentSection[];
  events: any[];
  event_prompts: string;
}

interface AISettings {
  system_prompt: string;
  model: string;
  temperature: string;
  max_tokens: string;
  monthly_limit_jpy: string;
  enabled: string;
  usd_to_jpy_rate: string;
  maintenance_mode: string;
  maintenance_tester_ids: string;
}

interface UsageStats {
  totalCostJPY: number;
  totalCostUSD: number;
  requestCount: number;
  limitJPY: number;
  remainingJPY: number;
  percentageUsed: number;
}

export default function AISettingsPage() {
  const { tenant } = useParams<{ tenant: string }>();

  // 基本設定
  const [basicSettings, setBasicSettings] = useState<AISettings | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);

  // 招待コード関連
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  // 固定項目
  const [schoolInfo, setSchoolInfo] = useState('');
  const [access, setAccess] = useState('');
  const [unableResponse, setUnableResponse] = useState('');
  const [closingMessage, setClosingMessage] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');

  // カスタム項目
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [editingItem, setEditingItem] = useState<CustomItem | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemContent, setNewItemContent] = useState('');

  // 自動追記ルール
  const [autoAppendRules, setAutoAppendRules] = useState<AutoAppendRule[]>([]);
  const [editingRule, setEditingRule] = useState<AutoAppendRule | null>(null);
  const [showAddRuleForm, setShowAddRuleForm] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleKeywords, setNewRuleKeywords] = useState('');
  const [newRuleMessage, setNewRuleMessage] = useState('');
  const [newRulePosition, setNewRulePosition] = useState<'end' | 'start'>('end');

  // 学科別情報
  const [departmentSections, setDepartmentSections] = useState<DepartmentSection[]>([]);
  const [editingDepartment, setEditingDepartment] = useState<DepartmentSection | null>(null);
  const [showAddDepartmentForm, setShowAddDepartmentForm] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newDepartmentKeywords, setNewDepartmentKeywords] = useState('');
  const [newDepartmentContent, setNewDepartmentContent] = useState('');
  const [newDepartmentInstructions, setNewDepartmentInstructions] = useState('');

  // 期間限定ルール
  const [periodRules, setPeriodRules] = useState<PeriodRule[]>([]);
  const [editingPeriodRule, setEditingPeriodRule] = useState<PeriodRule | null>(null);
  const [showAddPeriodRuleForm, setShowAddPeriodRuleForm] = useState(false);
  const [newPeriodRuleName, setNewPeriodRuleName] = useState('');
  const [newPeriodRuleMessage, setNewPeriodRuleMessage] = useState('');
  const [newPeriodRuleStartDate, setNewPeriodRuleStartDate] = useState('');
  const [newPeriodRuleEndDate, setNewPeriodRuleEndDate] = useState('');

  // プレビュー
  const [finalPrompt, setFinalPrompt] = useState('');
  const [promptParts, setPromptParts] = useState<PromptParts | null>(null);

  // タブ管理
  const [activeTab, setActiveTab] = useState<'basic' | 'fixed' | 'custom' | 'departments' | 'rules' | 'period' | 'preview'>('basic');

  // 状態管理
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchBasicSettings();
    fetchUsage();
    fetchPromptSettings();
    fetchPromptPreview();
    fetchInviteCode();

    // 10秒ごとに使用量を更新
    const interval = setInterval(fetchUsage, 10000);
    return () => clearInterval(interval);
  }, [tenant]);

  // 招待コード情報を取得
  const fetchInviteCode = async () => {
    try {
      const res = await fetch(`/api/${tenant}/admin/maintenance-invite`);
      const data = await res.json();
      if (data.success && data.isValid) {
        setInviteCode(data.code);
        setInviteExpiresAt(data.expiresAt);
      } else {
        setInviteCode(null);
        setInviteExpiresAt(null);
      }
    } catch (error) {
      console.error('Failed to fetch invite code:', error);
    }
  };

  // 招待コードを発行
  const generateInviteCode = async () => {
    setInviteLoading(true);
    try {
      const res = await fetch(`/api/${tenant}/admin/maintenance-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInMinutes: 10 }),
      });
      const data = await res.json();
      if (data.success) {
        setInviteCode(data.code);
        setInviteExpiresAt(data.expiresAt);
        setMessage('招待コードを発行しました ✅');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('招待コードの発行に失敗しました ❌');
      }
    } catch (error) {
      setMessage('エラーが発生しました ❌');
    } finally {
      setInviteLoading(false);
    }
  };

  // 基本設定を取得
  const fetchBasicSettings = async () => {
    try {
      const res = await fetch(`/api/${tenant}/admin/ai-settings`);
      const data = await res.json();

      if (data.success) {
        // デフォルト値をマージ（DBに値がない場合に対応）
        setBasicSettings({
          system_prompt: '',
          model: 'gpt-4o-mini',
          temperature: '0.7',
          max_tokens: '500',
          monthly_limit_jpy: '500',
          enabled: 'false',
          usd_to_jpy_rate: '150',
          maintenance_mode: 'false',
          maintenance_tester_ids: '[]',
          ...data.settings,
        });
      }
    } catch (error) {
      console.error('Failed to fetch basic settings:', error);
    }
  };

  // 使用量を取得
  const fetchUsage = async () => {
    try {
      const res = await fetch(`/api/${tenant}/admin/ai-usage`);
      const data = await res.json();

      if (data.success) {
        setUsage(data.usage);
      }
    } catch (error) {
      console.error('Failed to fetch usage:', error);
    }
  };

  // プロンプト設定を取得
  const fetchPromptSettings = async () => {
    try {
      const res = await fetch(`/api/${tenant}/admin/ai-prompt`);
      const data = await res.json();

      if (data.success && data.parts) {
        setSchoolInfo(data.parts.school_info || '');
        setAccess(data.parts.access || '');
        setUnableResponse(data.parts.unable_response || '');
        setClosingMessage(data.parts.closing_message || '');
        setAdditionalInstructions(data.parts.additional_instructions || '');
        setCustomItems(data.parts.custom_items || []);
        setAutoAppendRules(data.parts.auto_append_rules || []);
        setDepartmentSections(data.parts.department_sections || []);
        setPeriodRules(data.parts.period_rules || []);
      }
    } catch (error) {
      console.error('Failed to fetch prompt settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // プレビューを取得
  const fetchPromptPreview = async () => {
    try {
      const res = await fetch(`/api/${tenant}/admin/ai-prompt`);
      const data = await res.json();

      if (data.success) {
        setFinalPrompt(data.prompt || '');
        setPromptParts(data.parts || null);
      }
    } catch (error) {
      console.error('Failed to fetch prompt preview:', error);
    }
  };

  // 基本設定を保存
  const saveBasicSettings = async () => {
    if (!basicSettings) return;

    setSaving(true);
    setMessage('');

    try {
      const res = await fetch(`/api/${tenant}/admin/ai-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: basicSettings }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage('基本設定を保存しました ✅');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('保存に失敗しました ❌');
      }
    } catch (error) {
      setMessage('エラーが発生しました ❌');
    } finally {
      setSaving(false);
    }
  };

  // 固定項目を保存
  const saveFixedItem = async (key: string, value: string) => {
    setSaving(true);
    setMessage('');

    try {
      const res = await fetch(`/api/${tenant}/admin/ai-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setting_key: key, setting_value: value }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage('保存しました ✅');
        setTimeout(() => setMessage(''), 3000);
        fetchPromptPreview();
      } else {
        setMessage('保存に失敗しました ❌');
      }
    } catch (error) {
      setMessage('エラーが発生しました ❌');
    } finally {
      setSaving(false);
    }
  };

  // カスタム項目を自動保存（共通）
  const saveCustomItemsToServer = async (items: CustomItem[]) => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`/api/${tenant}/admin/ai-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setting_key: 'prompt_custom_items',
          setting_value: JSON.stringify(items),
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchPromptPreview();
        return true;
      } else {
        setMessage(`保存に失敗しました: ${data.error || '不明なエラー'} ❌`);
        return false;
      }
    } catch (error) {
      setMessage('保存中にエラーが発生しました ❌');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // カスタム項目を追加
  const addCustomItem = async () => {
    if (!newItemName.trim() || !newItemContent.trim()) {
      alert('項目名とコンテンツを入力してください');
      return;
    }

    const newItem: CustomItem = {
      id: `custom_${Date.now()}`,
      name: newItemName.trim(),
      content: newItemContent.trim(),
      order: customItems.length,
    };

    const updated = [...customItems, newItem];
    setCustomItems(updated);
    setNewItemName('');
    setNewItemContent('');
    setShowAddForm(false);

    if (await saveCustomItemsToServer(updated)) {
      setMessage('カスタム項目を追加して保存しました ✅');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // カスタム項目を編集
  const updateCustomItem = async () => {
    if (!editingItem) return;

    const updated = customItems.map((item) =>
      item.id === editingItem.id ? editingItem : item
    );
    setCustomItems(updated);
    setEditingItem(null);

    if (await saveCustomItemsToServer(updated)) {
      setMessage('カスタム項目を更新して保存しました ✅');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // カスタム項目を削除
  const deleteCustomItem = async (id: string) => {
    if (!confirm('この項目を削除しますか？')) return;

    const updated = customItems.filter((item) => item.id !== id);
    setCustomItems(updated);

    if (await saveCustomItemsToServer(updated)) {
      setMessage('カスタム項目を削除して保存しました ✅');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // 学科別情報を追加
  const addDepartment = async () => {
    if (!newDepartmentName.trim() || !newDepartmentContent.trim()) {
      alert('学科名と情報テキストを入力してください');
      return;
    }

    const newDept: DepartmentSection = {
      id: Date.now().toString(),
      name: newDepartmentName.trim(),
      keywords: newDepartmentKeywords.split(',').map(k => k.trim()).filter(k => k),
      content: newDepartmentContent.trim(),
      additional_instructions: newDepartmentInstructions.trim(),
      order: departmentSections.length,
    };

    const updated = [...departmentSections, newDept];
    setDepartmentSections(updated);
    setNewDepartmentName('');
    setNewDepartmentKeywords('');
    setNewDepartmentContent('');
    setNewDepartmentInstructions('');
    setShowAddDepartmentForm(false);

    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`/api/${tenant}/admin/ai-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setting_key: 'prompt_department_sections',
          setting_value: JSON.stringify(updated),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('学科情報を追加して保存しました ✅');
        setTimeout(() => setMessage(''), 3000);
        fetchPromptPreview();
      } else {
        setMessage(`保存に失敗しました: ${data.error || '不明なエラー'} ❌`);
      }
    } catch (error) {
      setMessage('保存中にエラーが発生しました ❌');
    } finally {
      setSaving(false);
    }
  };

  // 学科別情報を更新
  const updateDepartment = async () => {
    if (!editingDepartment) return;

    const updated = departmentSections.map((dept) =>
      dept.id === editingDepartment.id ? editingDepartment : dept
    );
    setDepartmentSections(updated);
    setEditingDepartment(null);

    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`/api/${tenant}/admin/ai-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setting_key: 'prompt_department_sections',
          setting_value: JSON.stringify(updated),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('学科情報を更新して保存しました ✅');
        setTimeout(() => setMessage(''), 3000);
        fetchPromptPreview();
      } else {
        setMessage(`保存に失敗しました: ${data.error || '不明なエラー'} ❌`);
      }
    } catch (error) {
      setMessage('保存中にエラーが発生しました ❌');
    } finally {
      setSaving(false);
    }
  };

  // 学科別情報を削除
  const deleteDepartment = async (id: string) => {
    if (!confirm('この学科情報を削除しますか？')) return;

    const updated = departmentSections.filter((dept) => dept.id !== id);
    setDepartmentSections(updated);

    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`/api/${tenant}/admin/ai-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setting_key: 'prompt_department_sections',
          setting_value: JSON.stringify(updated),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('学科情報を削除して保存しました ✅');
        setTimeout(() => setMessage(''), 3000);
        fetchPromptPreview();
      } else {
        setMessage(`保存に失敗しました: ${data.error || '不明なエラー'} ❌`);
      }
    } catch (error) {
      setMessage('保存中にエラーが発生しました ❌');
    } finally {
      setSaving(false);
    }
  };

  // 自動追記ルールを追加
  const addAutoAppendRule = async () => {
    if (!newRuleName.trim() || !newRuleKeywords.trim() || !newRuleMessage.trim()) {
      alert('ルール名、キーワード、メッセージをすべて入力してください');
      return;
    }

    const newRule: AutoAppendRule = {
      id: Date.now().toString(),
      name: newRuleName.trim(),
      keywords: newRuleKeywords.split(',').map(k => k.trim()).filter(k => k),
      message: newRuleMessage.trim(),
      position: newRulePosition,
      is_active: true,
      order: autoAppendRules.length,
    };

    const updatedRules = [...autoAppendRules, newRule];
    setAutoAppendRules(updatedRules);
    setNewRuleName('');
    setNewRuleKeywords('');
    setNewRuleMessage('');
    setNewRulePosition('end');
    setShowAddRuleForm(false);

    // 自動保存
    setSaving(true);
    setMessage('');

    try {
      console.log('[addAutoAppendRule] Auto-saving new rule:', newRule);

      const res = await fetch(`/api/${tenant}/admin/ai-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setting_key: 'prompt_auto_append_rules',
          setting_value: JSON.stringify(updatedRules),
        }),
      });

      console.log('[addAutoAppendRule] Response status:', res.status);
      const data = await res.json();
      console.log('[addAutoAppendRule] Response data:', data);

      if (data.success) {
        setMessage('ルールを追加して保存しました ✅');
        setTimeout(() => setMessage(''), 3000);
        fetchPromptPreview();
      } else {
        console.error('[addAutoAppendRule] Save failed:', data);
        setMessage(`ルールは追加されましたが保存に失敗しました: ${data.error || '不明なエラー'} ❌`);
      }
    } catch (error) {
      console.error('[addAutoAppendRule] Exception:', error);
      setMessage(`ルールは追加されましたが保存中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'} ❌`);
    } finally {
      setSaving(false);
    }
  };

  // 自動追記ルールを更新
  const updateAutoAppendRule = async () => {
    if (!editingRule) return;

    const updatedRules = autoAppendRules.map((rule) =>
      rule.id === editingRule.id ? editingRule : rule
    );
    setAutoAppendRules(updatedRules);
    setEditingRule(null);

    // 自動保存
    setSaving(true);
    setMessage('');

    try {
      console.log('[updateAutoAppendRule] Auto-saving updated rule:', editingRule);

      const res = await fetch(`/api/${tenant}/admin/ai-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setting_key: 'prompt_auto_append_rules',
          setting_value: JSON.stringify(updatedRules),
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage('ルールを更新して保存しました ✅');
        setTimeout(() => setMessage(''), 3000);
        fetchPromptPreview();
      } else {
        console.error('[updateAutoAppendRule] Save failed:', data);
        setMessage(`ルールは更新されましたが保存に失敗しました: ${data.error || '不明なエラー'} ❌`);
      }
    } catch (error) {
      console.error('[updateAutoAppendRule] Exception:', error);
      setMessage(`ルールは更新されましたが保存中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'} ❌`);
    } finally {
      setSaving(false);
    }
  };

  // 自動追記ルールを削除
  const deleteAutoAppendRule = async (id: string) => {
    if (!confirm('このルールを削除しますか？')) return;

    const updatedRules = autoAppendRules.filter((rule) => rule.id !== id);
    setAutoAppendRules(updatedRules);

    // 自動保存
    setSaving(true);
    setMessage('');

    try {
      console.log('[deleteAutoAppendRule] Auto-saving after deletion, remaining rules:', updatedRules.length);

      const res = await fetch(`/api/${tenant}/admin/ai-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setting_key: 'prompt_auto_append_rules',
          setting_value: JSON.stringify(updatedRules),
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage('ルールを削除して保存しました ✅');
        setTimeout(() => setMessage(''), 3000);
        fetchPromptPreview();
      } else {
        console.error('[deleteAutoAppendRule] Save failed:', data);
        setMessage(`ルールは削除されましたが保存に失敗しました: ${data.error || '不明なエラー'} ❌`);
      }
    } catch (error) {
      console.error('[deleteAutoAppendRule] Exception:', error);
      setMessage(`ルールは削除されましたが保存中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'} ❌`);
    } finally {
      setSaving(false);
    }
  };

  // 自動追記ルールの有効/無効を切り替え
  const toggleRuleActive = async (id: string) => {
    const updatedRules = autoAppendRules.map((rule) =>
      rule.id === id ? { ...rule, is_active: !rule.is_active } : rule
    );
    setAutoAppendRules(updatedRules);

    // 自動保存
    setSaving(true);
    setMessage('');

    try {
      console.log('[toggleRuleActive] Auto-saving after toggle, rule id:', id);

      const res = await fetch(`/api/${tenant}/admin/ai-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setting_key: 'prompt_auto_append_rules',
          setting_value: JSON.stringify(updatedRules),
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage('ルールの状態を変更して保存しました ✅');
        setTimeout(() => setMessage(''), 3000);
        fetchPromptPreview();
      } else {
        console.error('[toggleRuleActive] Save failed:', data);
        setMessage(`ルールの状態は変更されましたが保存に失敗しました: ${data.error || '不明なエラー'} ❌`);
      }
    } catch (error) {
      console.error('[toggleRuleActive] Exception:', error);
      setMessage(`ルールの状態は変更されましたが保存中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'} ❌`);
    } finally {
      setSaving(false);
    }
  };

  // 期間限定ルールを追加
  const addPeriodRule = async () => {
    if (!newPeriodRuleName.trim() || !newPeriodRuleMessage.trim() || !newPeriodRuleStartDate || !newPeriodRuleEndDate) {
      alert('ルール名、メッセージ、開始日、終了日をすべて入力してください');
      return;
    }

    const newRule: PeriodRule = {
      id: Date.now().toString(),
      name: newPeriodRuleName.trim(),
      message: newPeriodRuleMessage.trim(),
      start_date: newPeriodRuleStartDate,
      end_date: newPeriodRuleEndDate,
      is_active: true,
      order: periodRules.length,
    };

    const updatedRules = [...periodRules, newRule];
    setPeriodRules(updatedRules);
    setNewPeriodRuleName('');
    setNewPeriodRuleMessage('');
    setNewPeriodRuleStartDate('');
    setNewPeriodRuleEndDate('');
    setShowAddPeriodRuleForm(false);

    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`/api/${tenant}/admin/ai-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setting_key: 'prompt_period_rules',
          setting_value: JSON.stringify(updatedRules),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('期間限定ルールを追加して保存しました ✅');
        setTimeout(() => setMessage(''), 3000);
        fetchPromptPreview();
      } else {
        setMessage(`保存に失敗しました: ${data.error || '不明なエラー'} ❌`);
      }
    } catch (error) {
      setMessage(`保存中にエラーが発生しました ❌`);
    } finally {
      setSaving(false);
    }
  };

  // 期間限定ルールを更新
  const updatePeriodRule = async () => {
    if (!editingPeriodRule) return;

    const updatedRules = periodRules.map((rule) =>
      rule.id === editingPeriodRule.id ? editingPeriodRule : rule
    );
    setPeriodRules(updatedRules);
    setEditingPeriodRule(null);

    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`/api/${tenant}/admin/ai-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setting_key: 'prompt_period_rules',
          setting_value: JSON.stringify(updatedRules),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('期間限定ルールを更新して保存しました ✅');
        setTimeout(() => setMessage(''), 3000);
        fetchPromptPreview();
      } else {
        setMessage(`保存に失敗しました: ${data.error || '不明なエラー'} ❌`);
      }
    } catch (error) {
      setMessage(`保存中にエラーが発生しました ❌`);
    } finally {
      setSaving(false);
    }
  };

  // 期間限定ルールを削除
  const deletePeriodRule = async (id: string) => {
    if (!confirm('このルールを削除しますか？')) return;

    const updatedRules = periodRules.filter((rule) => rule.id !== id);
    setPeriodRules(updatedRules);

    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`/api/${tenant}/admin/ai-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setting_key: 'prompt_period_rules',
          setting_value: JSON.stringify(updatedRules),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('期間限定ルールを削除して保存しました ✅');
        setTimeout(() => setMessage(''), 3000);
        fetchPromptPreview();
      } else {
        setMessage(`保存に失敗しました: ${data.error || '不明なエラー'} ❌`);
      }
    } catch (error) {
      setMessage(`保存中にエラーが発生しました ❌`);
    } finally {
      setSaving(false);
    }
  };

  // 期間限定ルールの有効/無効を切り替え
  const togglePeriodRuleActive = async (id: string) => {
    const updatedRules = periodRules.map((rule) =>
      rule.id === id ? { ...rule, is_active: !rule.is_active } : rule
    );
    setPeriodRules(updatedRules);

    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`/api/${tenant}/admin/ai-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setting_key: 'prompt_period_rules',
          setting_value: JSON.stringify(updatedRules),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('ルールの状態を変更して保存しました ✅');
        setTimeout(() => setMessage(''), 3000);
        fetchPromptPreview();
      } else {
        setMessage(`保存に失敗しました: ${data.error || '不明なエラー'} ❌`);
      }
    } catch (error) {
      setMessage(`保存中にエラーが発生しました ❌`);
    } finally {
      setSaving(false);
    }
  };

  // 期間内かどうか判定するヘルパー
  const isPeriodActive = (rule: PeriodRule): boolean => {
    const today = new Date().toISOString().split('T')[0];
    return rule.is_active && rule.start_date <= today && today <= rule.end_date;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">AI自動応答設定</h1>
          <p className="text-sm text-gray-600 mt-1">GPT-4o-mini を使用した自動応答システムの管理</p>
        </div>

        {/* メッセージ表示 */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message}
          </div>
        )}

        {/* 使用量ダッシュボード */}
        {usage && (
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 mb-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center">
                <span className="mr-2">💰</span>
                今月の使用状況
              </h2>
              <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                リアルタイム更新
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <p className="text-sm text-white/80 mb-1">使用額</p>
                <p className="text-2xl font-bold">¥{usage.totalCostJPY.toFixed(2)}</p>
                <p className="text-xs text-white/60 mt-1">${usage.totalCostUSD.toFixed(4)} USD</p>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <p className="text-sm text-white/80 mb-1">上限</p>
                <p className="text-2xl font-bold">¥{usage.limitJPY}</p>
                <p className="text-xs text-white/60 mt-1">月間上限額</p>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <p className="text-sm text-white/80 mb-1">残り</p>
                <p className="text-2xl font-bold text-green-300">
                  ¥{usage.remainingJPY.toFixed(2)}
                </p>
                <p className="text-xs text-white/60 mt-1">利用可能額</p>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <p className="text-sm text-white/80 mb-1">リクエスト数</p>
                <p className="text-2xl font-bold text-purple-300">{usage.requestCount}回</p>
                <p className="text-xs text-white/60 mt-1">今月の合計</p>
              </div>
            </div>

            {/* プログレスバー */}
            <div className="bg-white/20 rounded-full h-3 overflow-hidden mb-2">
              <div
                className={`h-full transition-all duration-500 ${
                  usage.percentageUsed >= 90
                    ? 'bg-red-400'
                    : usage.percentageUsed >= 75
                    ? 'bg-yellow-400'
                    : 'bg-green-400'
                }`}
                style={{ width: `${Math.min(usage.percentageUsed, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span>{usage.percentageUsed.toFixed(1)}% 使用中</span>
              <span>
                {usage.percentageUsed >= 90 && '⚠️ 上限間近！'}
                {usage.percentageUsed < 90 && usage.percentageUsed >= 75 && '⚡ 75%到達'}
              </span>
            </div>

            {usage.percentageUsed >= 90 && (
              <div className="mt-4 bg-red-500/20 border border-red-300 rounded-lg p-3 text-sm">
                <p className="font-bold">⚠️ 警告: 使用量が90%を超えています</p>
                <p className="mt-1">95%に達すると自動的に機能が無効化されます</p>
              </div>
            )}
          </div>
        )}

        {/* タブナビゲーション */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('basic')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'basic'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                ⚙️ 基本設定
              </button>
              <button
                onClick={() => setActiveTab('fixed')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'fixed'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                📝 固定項目
              </button>
              <button
                onClick={() => setActiveTab('custom')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'custom'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                ✨ カスタム項目
              </button>
              <button
                onClick={() => setActiveTab('departments')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'departments'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                🏫 学科別情報
              </button>
              <button
                onClick={() => setActiveTab('rules')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'rules'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                🎯 自動追記ルール
              </button>
              <button
                onClick={() => setActiveTab('period')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'period'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                📅 期間限定ルール
              </button>
              <button
                onClick={() => {
                  setActiveTab('preview');
                  fetchPromptPreview();
                }}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'preview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                👁️ プレビュー
              </button>
            </nav>
          </div>

          {/* 基本設定タブ */}
          {activeTab === 'basic' && basicSettings && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">基本設定</h2>

              {/* AI機能ON/OFF */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="font-medium text-gray-900">AI自動応答機能</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {basicSettings.enabled === 'true' ? '有効' : '無効'} - LINE連携ユーザーへの自動応答
                    </p>
                  </div>
                  <div className="relative inline-block w-16 h-8">
                    <input
                      type="checkbox"
                      checked={basicSettings.enabled === 'true'}
                      onChange={(e) =>
                        setBasicSettings({
                          ...basicSettings,
                          enabled: e.target.checked ? 'true' : 'false',
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-16 h-8 bg-gray-300 peer-checked:bg-blue-600 rounded-full transition-colors peer-focus:ring-2 peer-focus:ring-blue-300"></div>
                    <div className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform peer-checked:translate-x-8"></div>
                  </div>
                </label>
              </div>

              {/* メンテナンスモード */}
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="font-medium text-gray-900 flex items-center">
                      <span className="mr-2">🔧</span>
                      メンテナンスモード
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {basicSettings.maintenance_mode === 'true'
                        ? '有効 - テスター以外のユーザーにはAI応答を停止'
                        : '無効 - 全ユーザーがAI機能を使用可能'}
                    </p>
                  </div>
                  <div className="relative inline-block w-16 h-8">
                    <input
                      type="checkbox"
                      checked={basicSettings.maintenance_mode === 'true'}
                      onChange={(e) =>
                        setBasicSettings({
                          ...basicSettings,
                          maintenance_mode: e.target.checked ? 'true' : 'false',
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-16 h-8 bg-gray-300 peer-checked:bg-yellow-500 rounded-full transition-colors peer-focus:ring-2 peer-focus:ring-yellow-300"></div>
                    <div className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform peer-checked:translate-x-8"></div>
                  </div>
                </label>

                {basicSettings.maintenance_mode === 'true' && (
                  <div className="mt-4 pt-4 border-t border-yellow-300">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      テスター用LINE User ID
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      メンテナンスモード中でもAI機能を使用できるLINEユーザーのIDを入力してください。
                      複数のIDを登録する場合は、カンマ区切りで入力してください。
                    </p>
                    <textarea
                      value={(() => {
                        try {
                          const ids = JSON.parse(basicSettings.maintenance_tester_ids || '[]');
                          return Array.isArray(ids) ? ids.join(', ') : '';
                        } catch {
                          return '';
                        }
                      })()}
                      onChange={(e) => {
                        const ids = e.target.value
                          .split(',')
                          .map((id) => id.trim())
                          .filter((id) => id);
                        setBasicSettings({
                          ...basicSettings,
                          maintenance_tester_ids: JSON.stringify(ids),
                        });
                      }}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent font-mono text-sm"
                      placeholder="例: Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx, Uyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      💡 LINE User IDは、LINEボットにメッセージを送った際のログ、または LINE Developers Console で確認できます。
                    </p>
                  </div>
                )}

                {basicSettings.maintenance_mode === 'true' && (
                  <div className="mt-4 p-3 bg-yellow-100 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>⚠️ メンテナンスモード有効中</strong>
                      <br />
                      テスター以外のユーザーには「メンテナンス中」のメッセージが表示されます。
                      プロンプトの修正・テストが完了したら、メンテナンスモードをOFFにしてください。
                    </p>
                  </div>
                )}

                {/* テスター招待コード発行（メンテナンスモードON時のみ表示） */}
                {basicSettings.maintenance_mode === 'true' && (
                  <div className="mt-4 pt-4 border-t border-yellow-300">
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                      <span className="mr-2">🎫</span>
                      テスター招待コード
                    </h4>
                    <p className="text-xs text-gray-600 mb-3">
                      招待コードを発行し、テスター希望者にLINEで「テスター登録 [コード]」と送信してもらうと、自動的にテスターリストに追加されます。
                    </p>

                    {inviteCode && inviteExpiresAt && new Date(inviteExpiresAt) > new Date() ? (
                      <div className="bg-white border-2 border-yellow-400 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">現在の招待コード:</span>
                          <span className="text-xs text-gray-500">
                            有効期限: {new Date(inviteExpiresAt).toLocaleTimeString('ja-JP')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <code className="flex-1 bg-yellow-50 text-2xl font-bold text-center py-3 rounded tracking-widest">
                            {inviteCode}
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`テスター登録 ${inviteCode}`);
                              setMessage('コピーしました ✅');
                              setTimeout(() => setMessage(''), 2000);
                            }}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                            title="コピー"
                          >
                            📋
                          </button>
                        </div>
                        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-blue-800 text-center font-medium mb-1">
                            📱 LINEボットに以下のメッセージを送信
                          </p>
                          <p className="text-xs text-blue-600 text-center mb-2">
                            ⚠️「テスター登録」と「コード」の間に<span className="font-bold text-red-600 underline">半角スペース</span>が必要です
                          </p>
                          <div className="bg-white rounded px-3 py-2 text-center border border-gray-200">
                            <code className="text-base font-mono">テスター登録<span className="bg-yellow-300 text-yellow-800 px-1 mx-0.5 rounded text-xs">␣</span>{inviteCode}</code>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-sm text-gray-500 mb-3">
                          {inviteCode ? '招待コードの有効期限が切れました' : '招待コードが発行されていません'}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={generateInviteCode}
                      disabled={inviteLoading}
                      className="mt-3 w-full bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400"
                    >
                      {inviteLoading ? '発行中...' : inviteCode ? '新しいコードを発行' : '招待コードを発行（10分間有効）'}
                    </button>
                  </div>
                )}

                {/* テスターリスト管理（メンテナンスモードON時のみ表示） */}
                {basicSettings.maintenance_mode === 'true' && (
                  <div className="mt-4 pt-4 border-t border-yellow-300">
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                    <span className="mr-2">👥</span>
                    登録済みテスター一覧
                  </h4>
                  <p className="text-xs text-gray-600 mb-3">
                    メンテナンスモード中にAI機能を使用できるユーザーの一覧です。
                  </p>

                  {(() => {
                    let testerIds: string[] = [];
                    try {
                      testerIds = JSON.parse(basicSettings.maintenance_tester_ids || '[]');
                    } catch {
                      testerIds = [];
                    }

                    if (testerIds.length === 0) {
                      return (
                        <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 text-sm">
                          登録されているテスターはいません
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {testerIds.map((id, index) => (
                          <div
                            key={id}
                            className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-gray-400 text-sm">#{index + 1}</span>
                              <code className="text-sm font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded">
                                {id.substring(0, 10)}...{id.substring(id.length - 6)}
                              </code>
                            </div>
                            <button
                              onClick={() => {
                                if (!confirm('このテスターを削除しますか？')) return;
                                const newIds = testerIds.filter((_, i) => i !== index);
                                setBasicSettings({
                                  ...basicSettings,
                                  maintenance_tester_ids: JSON.stringify(newIds),
                                });
                              }}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors text-sm"
                              title="削除"
                            >
                              🗑️ 削除
                            </button>
                          </div>
                        ))}
                        <p className="text-xs text-gray-500 mt-2">
                          ※ 削除後は「基本設定を保存」ボタンを押して変更を反映してください
                        </p>
                      </div>
                    );
                  })()}
                  </div>
                )}
              </div>

              {/* Temperature設定 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temperature（創造性）
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={basicSettings.temperature}
                  onChange={(e) =>
                    setBasicSettings({ ...basicSettings, temperature: e.target.value })
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>正確（0.0）</span>
                  <span className="font-bold">現在: {basicSettings.temperature}</span>
                  <span>創造的（2.0）</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  推奨値: 0.7（バランス型）。学校情報は正確性を重視して0.3-0.7を推奨
                </p>
              </div>

              {/* Max Tokens設定 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Tokens（回答の最大長）
                </label>
                <input
                  type="number"
                  min="100"
                  max="4000"
                  step="50"
                  value={basicSettings.max_tokens}
                  onChange={(e) =>
                    setBasicSettings({ ...basicSettings, max_tokens: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  現在: {basicSettings.max_tokens} tokens（日本語で約{Math.floor(parseInt(basicSettings.max_tokens) / 2)}文字）
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  推奨値: 500-1000。短めの回答は費用削減に効果的
                </p>
              </div>

              {/* 月間利用制限 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  月間利用上限（円）
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={basicSettings.monthly_limit_jpy}
                  onChange={(e) =>
                    setBasicSettings({ ...basicSettings, monthly_limit_jpy: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  現在の上限: ¥{basicSettings.monthly_limit_jpy} / 月
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  ⚠️ 95%に達すると自動的にAI機能が無効化されます
                </p>
              </div>

              {/* 為替レート */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  USD/JPY 為替レート
                </label>
                <input
                  type="number"
                  min="100"
                  max="200"
                  step="1"
                  value={basicSettings.usd_to_jpy_rate}
                  onChange={(e) =>
                    setBasicSettings({ ...basicSettings, usd_to_jpy_rate: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  現在: 1 USD = {basicSettings.usd_to_jpy_rate} 円（コスト計算に使用）
                </p>
              </div>

              {/* 保存ボタン */}
              <button
                onClick={saveBasicSettings}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? '保存中...' : '基本設定を保存'}
              </button>
            </div>
          )}

          {/* 固定項目タブ */}
          {activeTab === 'fixed' && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">固定項目の設定</h2>

              {/* 学校情報 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  学校情報
                </label>
                <textarea
                  value={schoolInfo}
                  onChange={(e) => setSchoolInfo(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="学校名、所在地、特徴、コース情報など"
                />
                <button
                  onClick={() => saveFixedItem('prompt_school_info', schoolInfo)}
                  disabled={saving}
                  className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>

              {/* アクセス */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  アクセス
                </label>
                <textarea
                  value={access}
                  onChange={(e) => setAccess(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="最寄り駅、バス、駐車場情報など"
                />
                <button
                  onClick={() => saveFixedItem('prompt_access', access)}
                  disabled={saving}
                  className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>

              {/* 回答できない場合 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  回答が出来なかった際に記述する内容
                </label>
                <textarea
                  value={unableResponse}
                  onChange={(e) => setUnableResponse(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="AIが回答できない質問への対応メッセージ"
                />
                <button
                  onClick={() => saveFixedItem('prompt_unable_response', unableResponse)}
                  disabled={saving}
                  className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>

              {/* 締めメッセージ */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  必ず最後に記述する内容
                </label>
                <textarea
                  value={closingMessage}
                  onChange={(e) => setClosingMessage(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="すべての回答の最後に追加されるメッセージ"
                />
                <button
                  onClick={() => saveFixedItem('prompt_closing_message', closingMessage)}
                  disabled={saving}
                  className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>

              {/* AI への追加指示 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI への追加指示（自由記述）
                </label>
                <p className="text-sm text-gray-500 mb-2">
                  AIに対する追加の指示を自然言語で自由に記述できます。自動追記ルールではカバーしきれない柔軟な指示に使えます。
                </p>
                <textarea
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={`例：\n・キャンパスライフについて聞かれたら https://example.com を案内してください\n・Instagramアカウント @xxx も案内してください\n・学費について聞かれたら奨学金制度も紹介してください`}
                />
                <button
                  onClick={() => saveFixedItem('prompt_additional_instructions', additionalInstructions)}
                  disabled={saving}
                  className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          )}

          {/* カスタム項目タブ */}
          {activeTab === 'custom' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">カスタム項目の管理</h2>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {showAddForm ? '✕ キャンセル' : '+ 新規追加'}
                </button>
              </div>

              {/* 新規追加フォーム */}
              {showAddForm && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="font-bold text-gray-900 mb-4">新しいカスタム項目を追加</h3>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      項目名
                    </label>
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="例: 入試情報"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      コンテンツ
                    </label>
                    <textarea
                      value={newItemContent}
                      onChange={(e) => setNewItemContent(e.target.value)}
                      rows={6}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="この項目の詳細な内容を記述してください"
                    />
                  </div>
                  <button
                    onClick={addCustomItem}
                    className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                  >
                    追加
                  </button>
                </div>
              )}

              {/* カスタム項目リスト */}
              {customItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg mb-2">カスタム項目がありません</p>
                  <p className="text-sm">「新規追加」ボタンから項目を追加してください</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {customItems
                    .sort((a, b) => a.order - b.order)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        {editingItem?.id === item.id ? (
                          // 編集モード
                          <div>
                            <input
                              type="text"
                              value={editingItem.name}
                              onChange={(e) =>
                                setEditingItem({ ...editingItem, name: e.target.value })
                              }
                              className="w-full mb-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <textarea
                              value={editingItem.content}
                              onChange={(e) =>
                                setEditingItem({ ...editingItem, content: e.target.value })
                              }
                              rows={6}
                              className="w-full mb-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={updateCustomItem}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                              >
                                更新
                              </button>
                              <button
                                onClick={() => setEditingItem(null)}
                                className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
                              >
                                キャンセル
                              </button>
                            </div>
                          </div>
                        ) : (
                          // 表示モード
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-bold text-gray-900">{item.name}</h3>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditingItem(item)}
                                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                >
                                  編集
                                </button>
                                <button
                                  onClick={() => deleteCustomItem(item.id)}
                                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                                >
                                  削除
                                </button>
                              </div>
                            </div>
                            <p className="text-gray-700 whitespace-pre-wrap">{item.content}</p>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}

            </div>
          )}

          {/* 学科別情報タブ */}
          {activeTab === 'departments' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">学科別情報の管理</h2>
                <button
                  onClick={() => setShowAddDepartmentForm(true)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  + 新しい学科を追加
                </button>
              </div>

              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">💡 学科別情報とは？</h3>
                <p className="text-sm text-gray-700">
                  学科（コース）ごとに個別の情報を登録できます。AIは質問内容からどの学科について聞いているかを判断し、該当学科の情報を使って回答します。
                </p>
                <p className="text-sm text-gray-700 mt-2">
                  どの学科か判別できない場合、AIは自動的にどの学科についてのお問い合わせかを確認します。
                </p>
              </div>

              {/* 新規追加フォーム */}
              {showAddDepartmentForm && (
                <div className="mb-6 p-6 bg-white border-2 border-green-500 rounded-lg shadow-lg">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">新しい学科を追加</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        学科名 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newDepartmentName}
                        onChange={(e) => setNewDepartmentName(e.target.value)}
                        placeholder="例: 看護学科"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        判定キーワード（カンマ区切り）
                      </label>
                      <input
                        type="text"
                        value={newDepartmentKeywords}
                        onChange={(e) => setNewDepartmentKeywords(e.target.value)}
                        placeholder="例: 看護, ナース, 看護師"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        AIがどの学科についての質問かを判断するためのキーワードです
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        学科の情報テキスト <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={newDepartmentContent}
                        onChange={(e) => setNewDepartmentContent(e.target.value)}
                        placeholder={'例:\n修業年限: 3年\nカリキュラム: 基礎看護学、成人看護学、小児看護学...\n取得資格: 看護師国家試験受験資格\n学費: 入学金〇〇万円、年間授業料〇〇万円'}
                        rows={8}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        この学科への追加指示（自由記述）
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        この学科についての質問に回答する際にAIに従ってほしい追加指示を記述できます
                      </p>
                      <textarea
                        value={newDepartmentInstructions}
                        onChange={(e) => setNewDepartmentInstructions(e.target.value)}
                        placeholder={'例:\n・学費について聞かれたら奨学金制度も紹介してください\n・実習先の病院名は回答しないでください'}
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={addDepartment}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      学科を追加
                    </button>
                    <button
                      onClick={() => {
                        setShowAddDepartmentForm(false);
                        setNewDepartmentName('');
                        setNewDepartmentKeywords('');
                        setNewDepartmentContent('');
                        setNewDepartmentInstructions('');
                      }}
                      className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}

              {/* 学科一覧 */}
              {departmentSections.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg mb-2">学科情報がありません</p>
                  <p className="text-sm">「+ 新しい学科を追加」ボタンから追加してください</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {departmentSections
                    .sort((a, b) => a.order - b.order)
                    .map((dept) => (
                      <div
                        key={dept.id}
                        className="p-5 rounded-lg border-2 bg-white border-indigo-200 shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-bold text-gray-900">{dept.name}</h3>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingDepartment(dept)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => deleteDepartment(dept.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              削除
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {dept.keywords.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-600 font-semibold mb-1">判定キーワード:</p>
                              <div className="flex flex-wrap gap-2">
                                {dept.keywords.map((keyword, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full"
                                  >
                                    {keyword}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <p className="text-xs text-gray-600 font-semibold mb-1">情報テキスト:</p>
                            <div className="bg-gray-50 p-3 rounded text-sm text-gray-800 whitespace-pre-wrap">
                              {dept.content}
                            </div>
                          </div>

                          {dept.additional_instructions && (
                            <div>
                              <p className="text-xs text-gray-600 font-semibold mb-1">追加指示:</p>
                              <div className="bg-yellow-50 p-3 rounded text-sm text-gray-800 whitespace-pre-wrap border border-yellow-200">
                                {dept.additional_instructions}
                              </div>
                            </div>
                          )}

                          <div className="text-xs text-gray-600">
                            📊 表示順: {dept.order + 1}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* 編集モーダル */}
              {editingDepartment && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">学科情報を編集</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          学科名
                        </label>
                        <input
                          type="text"
                          value={editingDepartment.name}
                          onChange={(e) =>
                            setEditingDepartment({ ...editingDepartment, name: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          判定キーワード（カンマ区切り）
                        </label>
                        <input
                          type="text"
                          value={editingDepartment.keywords.join(', ')}
                          onChange={(e) =>
                            setEditingDepartment({
                              ...editingDepartment,
                              keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k),
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          学科の情報テキスト
                        </label>
                        <textarea
                          value={editingDepartment.content}
                          onChange={(e) =>
                            setEditingDepartment({ ...editingDepartment, content: e.target.value })
                          }
                          rows={8}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          この学科への追加指示（自由記述）
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                          この学科についての質問に回答する際にAIに従ってほしい追加指示を記述できます
                        </p>
                        <textarea
                          value={editingDepartment.additional_instructions || ''}
                          onChange={(e) =>
                            setEditingDepartment({ ...editingDepartment, additional_instructions: e.target.value })
                          }
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder={'例:\n・学費について聞かれたら奨学金制度も紹介してください\n・実習先の病院名は回答しないでください'}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={updateDepartment}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        更新
                      </button>
                      <button
                        onClick={() => setEditingDepartment(null)}
                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 自動追記ルールタブ */}
          {activeTab === 'rules' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">自動追記ルールの管理</h2>
                <button
                  onClick={() => setShowAddRuleForm(true)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  + 新しいルールを追加
                </button>
              </div>

              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">💡 自動追記ルールとは？</h3>
                <p className="text-sm text-gray-700">
                  特定のキーワードを含む質問に対して、AIが自動的に指定のメッセージを回答の最後（または最初）に追加する機能です。
                </p>
                <p className="text-sm text-gray-700 mt-2">
                  例：「進路」「就職」などのキーワードを含む質問には、進路情報ページのURLを必ず案内する
                </p>
              </div>

              {/* 新規追加フォーム */}
              {showAddRuleForm && (
                <div className="mb-6 p-6 bg-white border-2 border-green-500 rounded-lg shadow-lg">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">新しいルールを追加</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ルール名 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newRuleName}
                        onChange={(e) => setNewRuleName(e.target.value)}
                        placeholder="例: 進路情報案内"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        トリガーキーワード（カンマ区切り） <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newRuleKeywords}
                        onChange={(e) => setNewRuleKeywords(e.target.value)}
                        placeholder="例: 進路, 就職, 進学, 卒業後"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        これらのキーワードのいずれかが質問に含まれている場合、メッセージが追加されます
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        追加するメッセージ <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={newRuleMessage}
                        onChange={(e) => setNewRuleMessage(e.target.value)}
                        placeholder={'例:\n詳しくは進路情報ページをご覧ください\nhttps://www.isegakuen.ac.jp/highschool/shinro/jokyo/index.html'}
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        挿入位置
                      </label>
                      <select
                        value={newRulePosition}
                        onChange={(e) => setNewRulePosition(e.target.value as 'end' | 'start')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="end">回答の最後</option>
                        <option value="start">回答の最初</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={addAutoAppendRule}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      ルールを追加
                    </button>
                    <button
                      onClick={() => {
                        setShowAddRuleForm(false);
                        setNewRuleName('');
                        setNewRuleKeywords('');
                        setNewRuleMessage('');
                        setNewRulePosition('end');
                      }}
                      className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}

              {/* ルール一覧 */}
              {autoAppendRules.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg mb-2">自動追記ルールがありません</p>
                  <p className="text-sm">「+ 新しいルールを追加」ボタンから追加してください</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {autoAppendRules
                    .sort((a, b) => a.order - b.order)
                    .map((rule) => (
                      <div
                        key={rule.id}
                        className={`p-5 rounded-lg border-2 shadow ${
                          rule.is_active
                            ? 'bg-white border-green-200'
                            : 'bg-gray-50 border-gray-300 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleRuleActive(rule.id)}
                              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                                rule.is_active
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              }`}
                            >
                              {rule.is_active ? '✓ 有効' : '無効'}
                            </button>
                            <h3 className="text-lg font-bold text-gray-900">{rule.name}</h3>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingRule(rule)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => deleteAutoAppendRule(rule.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              削除
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-gray-600 font-semibold mb-1">トリガーキーワード:</p>
                            <div className="flex flex-wrap gap-2">
                              {rule.keywords.map((keyword, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                >
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-xs text-gray-600 font-semibold mb-1">追加メッセージ:</p>
                            <div className="bg-gray-50 p-3 rounded text-sm text-gray-800 whitespace-pre-wrap">
                              {rule.message}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-gray-600">
                            <span>
                              📍 挿入位置: <span className="font-semibold">{rule.position === 'end' ? '回答の最後' : '回答の最初'}</span>
                            </span>
                            <span>
                              📊 表示順: {rule.order + 1}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* 編集モーダル */}
              {editingRule && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">ルールを編集</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ルール名
                        </label>
                        <input
                          type="text"
                          value={editingRule.name}
                          onChange={(e) =>
                            setEditingRule({ ...editingRule, name: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          トリガーキーワード（カンマ区切り）
                        </label>
                        <input
                          type="text"
                          value={editingRule.keywords.join(', ')}
                          onChange={(e) =>
                            setEditingRule({
                              ...editingRule,
                              keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k),
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          追加するメッセージ
                        </label>
                        <textarea
                          value={editingRule.message}
                          onChange={(e) =>
                            setEditingRule({ ...editingRule, message: e.target.value })
                          }
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          挿入位置
                        </label>
                        <select
                          value={editingRule.position}
                          onChange={(e) =>
                            setEditingRule({
                              ...editingRule,
                              position: e.target.value as 'end' | 'start',
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="end">回答の最後</option>
                          <option value="start">回答の最初</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={updateAutoAppendRule}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        更新
                      </button>
                      <button
                        onClick={() => setEditingRule(null)}
                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 期間限定ルールタブ */}
          {activeTab === 'period' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">期間限定ルールの管理</h2>
                <button
                  onClick={() => setShowAddPeriodRuleForm(true)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  + 新しいルールを追加
                </button>
              </div>

              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">💡 期間限定ルールとは？</h3>
                <p className="text-sm text-gray-700">
                  指定した期間（開始日〜終了日）の間だけ、AIのすべての回答に自動的にメッセージを追記する機能です。
                </p>
                <p className="text-sm text-gray-700 mt-2">
                  例：オープンキャンパス開催前の1ヶ月間だけ、申込案内を全回答に追加する
                </p>
              </div>

              {/* 新規追加フォーム */}
              {showAddPeriodRuleForm && (
                <div className="mb-6 p-6 bg-white border-2 border-green-500 rounded-lg shadow-lg">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">新しい期間限定ルールを追加</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ルール名 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newPeriodRuleName}
                        onChange={(e) => setNewPeriodRuleName(e.target.value)}
                        placeholder="例: OC申込案内"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        追記するメッセージ <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={newPeriodRuleMessage}
                        onChange={(e) => setNewPeriodRuleMessage(e.target.value)}
                        placeholder={'例:\nオープンキャンパスの申込受付中です！\n詳しくはこちら → https://example.com/apply'}
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          開始日 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={newPeriodRuleStartDate}
                          onChange={(e) => setNewPeriodRuleStartDate(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          終了日 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={newPeriodRuleEndDate}
                          onChange={(e) => setNewPeriodRuleEndDate(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={addPeriodRule}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      ルールを追加
                    </button>
                    <button
                      onClick={() => {
                        setShowAddPeriodRuleForm(false);
                        setNewPeriodRuleName('');
                        setNewPeriodRuleMessage('');
                        setNewPeriodRuleStartDate('');
                        setNewPeriodRuleEndDate('');
                      }}
                      className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}

              {/* ルール一覧 */}
              {periodRules.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg mb-2">期間限定ルールがありません</p>
                  <p className="text-sm">「+ 新しいルールを追加」ボタンから追加してください</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {periodRules
                    .sort((a, b) => a.order - b.order)
                    .map((rule) => (
                      <div
                        key={rule.id}
                        className={`p-5 rounded-lg border-2 shadow ${
                          isPeriodActive(rule)
                            ? 'bg-white border-green-200'
                            : rule.is_active
                            ? 'bg-white border-yellow-200'
                            : 'bg-gray-50 border-gray-300 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => togglePeriodRuleActive(rule.id)}
                              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                                rule.is_active
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              }`}
                            >
                              {rule.is_active ? '✓ 有効' : '無効'}
                            </button>
                            {isPeriodActive(rule) && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-semibold">
                                📅 期間内
                              </span>
                            )}
                            {rule.is_active && !isPeriodActive(rule) && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-semibold">
                                ⏳ 期間外
                              </span>
                            )}
                            <h3 className="text-lg font-bold text-gray-900">{rule.name}</h3>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingPeriodRule(rule)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => deletePeriodRule(rule.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              削除
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-gray-600 font-semibold mb-1">期間:</p>
                            <p className="text-sm text-gray-800">
                              {rule.start_date} 〜 {rule.end_date}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-600 font-semibold mb-1">追記メッセージ:</p>
                            <div className="bg-gray-50 p-3 rounded text-sm text-gray-800 whitespace-pre-wrap">
                              {rule.message}
                            </div>
                          </div>

                          <div className="text-xs text-gray-600">
                            📊 表示順: {rule.order + 1}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* 編集モーダル */}
              {editingPeriodRule && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">期間限定ルールを編集</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ルール名
                        </label>
                        <input
                          type="text"
                          value={editingPeriodRule.name}
                          onChange={(e) =>
                            setEditingPeriodRule({ ...editingPeriodRule, name: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          追記するメッセージ
                        </label>
                        <textarea
                          value={editingPeriodRule.message}
                          onChange={(e) =>
                            setEditingPeriodRule({ ...editingPeriodRule, message: e.target.value })
                          }
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            開始日
                          </label>
                          <input
                            type="date"
                            value={editingPeriodRule.start_date}
                            onChange={(e) =>
                              setEditingPeriodRule({ ...editingPeriodRule, start_date: e.target.value })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            終了日
                          </label>
                          <input
                            type="date"
                            value={editingPeriodRule.end_date}
                            onChange={(e) =>
                              setEditingPeriodRule({ ...editingPeriodRule, end_date: e.target.value })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={updatePeriodRule}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        更新
                      </button>
                      <button
                        onClick={() => setEditingPeriodRule(null)}
                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* プレビュータブ */}
          {activeTab === 'preview' && (
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">最終プロンプトのプレビュー</h2>

              {/* イベントプレビュー */}
              {promptParts && promptParts.events.length > 0 && (
                <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-bold text-gray-900 mb-4 text-lg">
                    📅 イベントプレビュー（プロンプトに含まれる内容）
                  </h3>
                  <div className="space-y-4">
                    {promptParts.events.map((event: any) => (
                      <div key={event.id} className="bg-white p-5 rounded-lg border border-blue-200 shadow-sm">
                        <h4 className="font-bold text-gray-900 text-lg mb-2">{event.name}</h4>

                        {event.overview && (
                          <div className="mb-3">
                            <p className="text-sm font-semibold text-gray-600 mb-1">概要:</p>
                            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{event.overview}</p>
                          </div>
                        )}

                        {event.description && (
                          <div className="mb-3">
                            <p className="text-sm font-semibold text-gray-600 mb-1">補足情報（管理用メモ）:</p>
                            <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded border border-yellow-200">
                              {event.description}
                            </p>
                          </div>
                        )}

                        {event.dates && event.dates.length > 0 && (
                          <div className="mb-3">
                            <p className="font-semibold text-gray-800 mb-2 text-sm">開催日程:</p>
                            <div className="space-y-1 ml-4">
                              {event.dates.map((date: any, idx: number) => {
                                const dateStr = new Date(date.date).toLocaleDateString('ja-JP', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  weekday: 'short',
                                });
                                const remaining = (date.capacity || 0) - (date.current_count || 0);
                                return (
                                  <p key={idx} className="text-sm text-gray-700">
                                    • {dateStr}: 定員{date.capacity || 0}名（残り{remaining}名）
                                  </p>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {event.courses && event.courses.length > 0 && (
                          <div>
                            <p className="font-semibold text-gray-800 mb-2 text-sm">コース情報:</p>
                            <div className="space-y-1 ml-4">
                              {event.courses.map((course: any, idx: number) => (
                                <p key={idx} className="text-sm text-gray-700">
                                  • {course.name}
                                  {course.description && <span className="text-gray-600">: {course.description}</span>}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {(!event.dates || event.dates.length === 0) &&
                         (!event.courses || event.courses.length === 0) && (
                          <p className="text-xs text-gray-500 italic">日程・コース情報なし</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {promptParts && promptParts.events.length === 0 && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ 現在、有効なイベントが登録されていません。イベント管理画面から表示終了日が未来のイベントを作成してください。
                  </p>
                </div>
              )}

              {/* カスタム項目プレビュー */}
              {promptParts && promptParts.custom_items && promptParts.custom_items.length > 0 && (
                <div className="mb-6 p-6 bg-purple-50 border border-purple-200 rounded-lg">
                  <h3 className="font-bold text-gray-900 mb-4 text-lg">
                    ✨ カスタム項目プレビュー（プロンプトに含まれる内容）
                  </h3>
                  <div className="space-y-4">
                    {promptParts.custom_items
                      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                      .map((item: any, index: number) => (
                        <div key={item.id || index} className="bg-white p-5 rounded-lg border border-purple-200 shadow-sm">
                          <h4 className="font-bold text-gray-900 text-lg mb-2">【{item.name}】</h4>
                          <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded whitespace-pre-wrap">
                            {item.content}
                          </div>
                          <p className="text-xs text-gray-500 mt-2">表示順: {item.order + 1}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {promptParts && (!promptParts.custom_items || promptParts.custom_items.length === 0) && (
                <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600">
                    ℹ️ カスタム項目が登録されていません。カスタム項目タブから追加できます。
                  </p>
                </div>
              )}

              {/* 学科別情報プレビュー */}
              {promptParts && promptParts.department_sections && promptParts.department_sections.length > 0 && (
                <div className="mb-6 p-6 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <h3 className="font-bold text-gray-900 mb-4 text-lg">
                    🏫 学科別情報プレビュー（プロンプトに含まれる内容）
                  </h3>
                  <div className="space-y-4">
                    {promptParts.department_sections
                      .sort((a: DepartmentSection, b: DepartmentSection) => (a.order || 0) - (b.order || 0))
                      .map((dept: DepartmentSection, index: number) => (
                        <div key={dept.id || index} className="bg-white p-5 rounded-lg border border-indigo-200 shadow-sm">
                          <h4 className="font-bold text-gray-900 text-lg mb-2">{dept.name}</h4>
                          {dept.keywords.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs text-gray-600 font-semibold mb-1">判定キーワード:</p>
                              <div className="flex flex-wrap gap-2">
                                {dept.keywords.map((keyword: string, idx: number) => (
                                  <span key={idx} className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full">
                                    {keyword}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-gray-600 font-semibold mb-1">情報テキスト:</p>
                            <div className="bg-gray-50 p-3 rounded text-sm text-gray-800 whitespace-pre-wrap">
                              {dept.content}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {promptParts && (!promptParts.department_sections || promptParts.department_sections.length === 0) && (
                <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600">
                    ℹ️ 学科別情報が登録されていません。学科別情報タブから追加できます。
                  </p>
                </div>
              )}

              {/* 自動追記ルールプレビュー */}
              {promptParts && promptParts.auto_append_rules && promptParts.auto_append_rules.length > 0 && (
                <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="font-bold text-gray-900 mb-4 text-lg">
                    🎯 自動追記ルールプレビュー（プロンプトに含まれる内容）
                  </h3>
                  <div className="space-y-4">
                    {promptParts.auto_append_rules
                      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                      .map((rule: any, index: number) => (
                        <div
                          key={rule.id || index}
                          className={`p-5 rounded-lg border-2 shadow-sm ${
                            rule.is_active
                              ? 'bg-white border-green-300'
                              : 'bg-gray-50 border-gray-300 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                rule.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-200 text-gray-600'
                              }`}
                            >
                              {rule.is_active ? '✓ 有効' : '無効'}
                            </span>
                            <h4 className="font-bold text-gray-900 text-lg">{rule.name}</h4>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <p className="text-xs text-gray-600 font-semibold mb-1">
                                トリガーキーワード:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {Array.isArray(rule.keywords) &&
                                  rule.keywords.map((keyword: string, idx: number) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                    >
                                      {keyword}
                                    </span>
                                  ))}
                              </div>
                            </div>

                            <div>
                              <p className="text-xs text-gray-600 font-semibold mb-1">
                                追加メッセージ:
                              </p>
                              <div className="bg-gray-50 p-3 rounded text-sm text-gray-800 whitespace-pre-wrap">
                                {rule.message}
                              </div>
                            </div>

                            <div className="text-xs text-gray-600">
                              📍 挿入位置:{' '}
                              <span className="font-semibold">
                                {rule.position === 'end' ? '回答の最後' : '回答の最初'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {promptParts && (!promptParts.auto_append_rules || promptParts.auto_append_rules.length === 0) && (
                <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600">
                    ℹ️ 自動追記ルールが登録されていません。自動追記ルールタブから追加できます。
                  </p>
                </div>
              )}

              {/* 期間限定ルールプレビュー */}
              {promptParts && promptParts.period_rules && promptParts.period_rules.length > 0 && (
                <div className="mb-6 p-6 bg-orange-50 border border-orange-200 rounded-lg">
                  <h3 className="font-bold text-gray-900 mb-4 text-lg">
                    📅 期間限定ルールプレビュー
                  </h3>
                  <div className="space-y-4">
                    {promptParts.period_rules
                      .sort((a: PeriodRule, b: PeriodRule) => (a.order || 0) - (b.order || 0))
                      .map((rule: PeriodRule, index: number) => {
                        const active = isPeriodActive(rule);
                        return (
                          <div
                            key={rule.id || index}
                            className={`p-5 rounded-lg border-2 shadow-sm ${
                              active
                                ? 'bg-white border-green-300'
                                : rule.is_active
                                ? 'bg-white border-yellow-300'
                                : 'bg-gray-50 border-gray-300 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  active
                                    ? 'bg-green-100 text-green-800'
                                    : rule.is_active
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                {active ? '✓ 期間内・有効' : rule.is_active ? '⏳ 期間外' : '無効'}
                              </span>
                              <h4 className="font-bold text-gray-900 text-lg">{rule.name}</h4>
                            </div>

                            <div className="space-y-2">
                              <div>
                                <p className="text-xs text-gray-600 font-semibold mb-1">期間:</p>
                                <p className="text-sm text-gray-800">
                                  {rule.start_date} 〜 {rule.end_date}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-gray-600 font-semibold mb-1">
                                  追記メッセージ{active ? '（プロンプトに含まれています）' : '（プロンプトに含まれていません）'}:
                                </p>
                                <div className="bg-gray-50 p-3 rounded text-sm text-gray-800 whitespace-pre-wrap">
                                  {rule.message}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {promptParts && (!promptParts.period_rules || promptParts.period_rules.length === 0) && (
                <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600">
                    ℹ️ 期間限定ルールが登録されていません。期間限定ルールタブから追加できます。
                  </p>
                </div>
              )}

              {/* 最終プロンプト */}
              <div className="mb-4">
                <h3 className="font-bold text-gray-900 mb-3 text-lg">🤖 AIに送信される最終プロンプト</h3>
                <div className="bg-gray-900 text-gray-100 p-6 rounded-lg font-mono text-sm overflow-x-auto max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap">{finalPrompt}</pre>
                </div>
              </div>

              <button
                onClick={fetchPromptPreview}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
              >
                🔄 再読み込み
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
