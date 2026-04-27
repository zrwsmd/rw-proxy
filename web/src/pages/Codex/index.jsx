/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useMemo, useState } from 'react';
import {
  Banner,
  Button,
  Card,
  Select,
  Space,
  Spin,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { IconCopy, IconRefresh } from '@douyinfe/semi-icons';
import { API, copy, removeTrailingSlash, showError, showSuccess } from '../../helpers';
import { fetchTokenKey, getServerAddress } from '../../helpers/token';

const RECOMMENDED_MODEL_ORDER = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5',
  'gpt-5-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4o',
  'gpt-4o-mini',
  'codex-mini-latest',
];

function sortRecommendedModels(models) {
  return [...models].sort((a, b) => {
    const indexA = RECOMMENDED_MODEL_ORDER.indexOf(a);
    const indexB = RECOMMENDED_MODEL_ORDER.indexOf(b);

    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });
}

function filterRecommendedModels(models) {
  return sortRecommendedModels(
    models.filter((model) => model.startsWith('gpt-') || model.includes('codex')),
  );
}

function buildCodexConfig(serverAddress, model) {
  const baseUrl = `${removeTrailingSlash(serverAddress)}/v1`;
  return `model_provider = "rw_proxy"
model = "${model}"
review_model = "${model}"
model_reasoning_effort = "medium"

[model_providers.rw_proxy]
name = "rw-proxy"
base_url = "${baseUrl}"
wire_api = "responses"
requires_openai_auth = true`;
}

function buildPowerShellLoginCommand(apiKey) {
  return `'${apiKey}' | codex login --with-api-key`;
}

function buildBashLoginCommand(apiKey) {
  return `printf '%s' '${apiKey}' | codex login --with-api-key`;
}

async function copyText(text, successMessage) {
  const ok = await copy(text);
  if (ok) {
    showSuccess(successMessage);
  } else {
    showError('复制失败');
  }
}

const CodexPage = () => {
  const [loading, setLoading] = useState(true);
  const [tokenOptions, setTokenOptions] = useState([]);
  const [selectedTokenId, setSelectedTokenId] = useState();
  const [selectedTokenKey, setSelectedTokenKey] = useState('');
  const [modelOptions, setModelOptions] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [refreshSeed, setRefreshSeed] = useState(0);

  const serverAddress = useMemo(() => getServerAddress(), []);

  const loadActiveTokens = async () => {
    const res = await API.get('/api/token/?p=1&size=100');
    const { success, message, data } = res.data || {};
    if (!success) {
      throw new Error(message || '加载令牌失败');
    }

    const items = Array.isArray(data) ? data : data?.items || [];
    const activeTokens = items.filter((token) => token.status === 1);
    const options = activeTokens.map((token) => ({
      label: token.name || `Token #${token.id}`,
      value: token.id,
    }));

    setTokenOptions(options);
    if (options.length > 0) {
      setSelectedTokenId((current) =>
        options.some((option) => option.value === current) ? current : options[0].value,
      );
    } else {
      setSelectedTokenId(undefined);
      setSelectedTokenKey('');
      setModelOptions([]);
      setSelectedModel('');
    }
  };

  const loadCodexModels = async (fullApiKey) => {
    const response = await fetch(`${removeTrailingSlash(serverAddress)}/v1/models`, {
      headers: {
        Authorization: `Bearer ${fullApiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`加载模型失败 (${response.status})`);
    }

    const payload = await response.json();
    const modelIds = Array.isArray(payload?.data)
      ? payload.data.map((item) => item?.id).filter(Boolean)
      : [];
    const recommendedModels = filterRecommendedModels(modelIds);

    setModelOptions(
      recommendedModels.map((model) => ({
        label: model,
        value: model,
      })),
    );
    setSelectedModel((current) =>
      recommendedModels.includes(current) ? current : recommendedModels[0] || '',
    );
  };

  const reloadPageData = async () => {
    setLoading(true);
    try {
      await loadActiveTokens();
      setRefreshSeed((seed) => seed + 1);
    } catch (error) {
      showError(error.message || '加载 Codex 配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadPageData();
  }, []);

  useEffect(() => {
    if (!selectedTokenId) {
      return;
    }

    let cancelled = false;

    const loadTokenDetails = async () => {
      setLoading(true);
      try {
        const tokenKey = await fetchTokenKey(selectedTokenId);
        const fullApiKey = `sk-${tokenKey}`;
        if (cancelled) return;

        setSelectedTokenKey(fullApiKey);
        await loadCodexModels(fullApiKey);
      } catch (error) {
        if (!cancelled) {
          setSelectedTokenKey('');
          setModelOptions([]);
          setSelectedModel('');
          showError(error.message || '加载 Codex 模型失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadTokenDetails();

    return () => {
      cancelled = true;
    };
  }, [selectedTokenId, serverAddress, refreshSeed]);

  const codexConfig = selectedModel
    ? buildCodexConfig(serverAddress, selectedModel)
    : '';
  const loginCommand = selectedTokenKey
    ? buildPowerShellLoginCommand(selectedTokenKey)
    : '';
  const bashLoginCommand = selectedTokenKey
    ? buildBashLoginCommand(selectedTokenKey)
    : '';

  return (
    <div className='mt-[60px] px-2'>
      <Spin spinning={loading}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <Space vertical align='start' style={{ width: '100%' }} spacing='loose'>
            <div>
              <Typography.Title heading={4} style={{ marginBottom: 8 }}>
                Codex 配置导出
              </Typography.Title>
              <Typography.Text type='secondary'>
                第一版只筛选 GPT / Codex 推荐模型，生成可直接接入 rw-proxy 的 Codex 配置。
              </Typography.Text>
            </div>

            <Banner
              fullMode={false}
              type='info'
              description='这里导出的 API Key 是 rw-proxy 令牌，不是上游厂商的真实 Key。上游 OpenAI、百炼等渠道仍然只保存在 rw-proxy 后台。'
            />

            <Card
              title='1. 选择令牌与模型'
              style={{ width: '100%' }}
              bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <Space wrap>
                <div style={{ minWidth: 320 }}>
                  <Typography.Text strong>可用令牌</Typography.Text>
                  <Select
                    style={{ width: '100%', marginTop: 8 }}
                    optionList={tokenOptions}
                    value={selectedTokenId}
                    onChange={setSelectedTokenId}
                    placeholder='请选择一个已启用令牌'
                    emptyContent='当前没有可用的已启用令牌'
                  />
                </div>

                <div style={{ minWidth: 320 }}>
                  <Typography.Text strong>推荐模型</Typography.Text>
                  <Select
                    style={{ width: '100%', marginTop: 8 }}
                    optionList={modelOptions}
                    value={selectedModel}
                    onChange={setSelectedModel}
                    placeholder='请选择推荐 GPT 模型'
                    emptyContent='当前令牌下没有推荐 GPT 模型'
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <Button icon={<IconRefresh />} onClick={reloadPageData}>
                    刷新
                  </Button>
                </div>
              </Space>

              <Space wrap>
                <Tag color='blue'>Gateway: {removeTrailingSlash(serverAddress)}/v1</Tag>
                {selectedModel ? <Tag color='green'>Model: {selectedModel}</Tag> : null}
              </Space>

              {tokenOptions.length === 0 ? (
                <Banner
                  fullMode={false}
                  type='warning'
                  description='还没有已启用令牌。请先去令牌管理页创建或启用一个 token。'
                />
              ) : null}

              {tokenOptions.length > 0 && modelOptions.length === 0 ? (
                <Banner
                  fullMode={false}
                  type='warning'
                  description='当前令牌没有开放推荐 GPT 模型。第一版 Codex 导出页只支持 GPT / Codex 推荐模型。'
                />
              ) : null}
            </Card>

            <Card
              title='2. 写入 ~/.codex/config.toml'
              style={{ width: '100%' }}
              extra={
                <Button
                  icon={<IconCopy />}
                  disabled={!codexConfig}
                  onClick={() => copyText(codexConfig, 'Codex 配置已复制')}
                >
                  复制配置
                </Button>
              }
            >
              <TextArea
                value={codexConfig}
                readOnly
                autosize={{ minRows: 10, maxRows: 16 }}
                placeholder='选择令牌和模型后，这里会生成 Codex 的 config.toml 配置。'
              />
            </Card>

            <Card
              title='3. 登录 Codex'
              style={{ width: '100%' }}
              bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Typography.Text strong>PowerShell</Typography.Text>
                  <Button
                    icon={<IconCopy />}
                    disabled={!loginCommand}
                    onClick={() => copyText(loginCommand, 'PowerShell 登录命令已复制')}
                  >
                    复制命令
                  </Button>
                </div>
                <TextArea
                  value={loginCommand}
                  readOnly
                  autosize={{ minRows: 2, maxRows: 4 }}
                  placeholder='选择令牌后，这里会生成 PowerShell 登录命令。'
                />
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Typography.Text strong>Bash</Typography.Text>
                  <Button
                    icon={<IconCopy />}
                    disabled={!bashLoginCommand}
                    onClick={() => copyText(bashLoginCommand, 'Bash 登录命令已复制')}
                  >
                    复制命令
                  </Button>
                </div>
                <TextArea
                  value={bashLoginCommand}
                  readOnly
                  autosize={{ minRows: 2, maxRows: 4 }}
                  placeholder='如果你在 WSL 或 Linux 下使用 Codex，可以复制这一段。'
                />
              </div>
            </Card>
          </Space>
        </div>
      </Spin>
    </div>
  );
};

export default CodexPage;
