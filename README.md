# Reliability RCM - Análise de Confiabilidade de Equipamentos

Este é um aplicativo web interativo, construído com Next.js e TypeScript, projetado para engenheiros de confiabilidade e manutenção. Ele fornece um conjunto de ferramentas estatísticas e de inteligência artificial para analisar dados de falha de equipamentos, estimar a vida útil de componentes e tomar decisões informadas sobre estratégias de manutenção.

## Stack de Tecnologia

- **Framework:** [Next.js](https://nextjs.org/) (React)
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/)
- **Componentes UI:** [ShadCN UI](https://ui.shadcn.com/)
- **Gráficos:** [ECharts for React](https://echarts.apache.org/handbook/en/how-to/use-in-react/)
- **Inteligência Artificial:** [Google Gemini](https://ai.google.dev/)

## Funcionalidades Principais

### 1. Gestão e Entrada de Dados Avançada

- **Múltiplos Equipamentos:** Adicione e compare até cinco equipamentos ou fornecedores simultaneamente.
- **Formatos de Dados Flexíveis:** O sistema suporta vários formatos de entrada de dados de tempo até a falha (TTF):
  - **Dados Simples:** Uma lista de tempos de falha.
  - **Dados Agrupados:** Tempos de falha com suas respectivas quantidades (ex: `1000h 10 falhas`).
  - **Dados com Suspensão (Censurados):** Itens que foram retirados de serviço antes de falhar (ex: `1100h S`).
  - **Dados Mistos:** Combinação de dados agrupados e com suspensão em um formato de três colunas (`Tempo`, `Qtd. Falhas`, `Qtd. Suspensões`).

### 2. Análise Estatística e Estimação de Parâmetros

- **Múltiplas Distribuições:** Analise os dados usando as distribuições estatísticas mais comuns em engenharia de confiabilidade:
  - Weibull
  - Normal
  - Lognormal
  - Exponencial
- **Métodos de Estimação:** Calcule os parâmetros das distribuições usando métodos padrão da indústria:
  - **SRM (Standard Rank Regression):** Regressão de Y em X, o método mais comum.
  - **RRX (Rank Regression on X):** Regressão de X em Y, útil para certas análises.
  - **MLE (Maximum Likelihood Estimation):** Máxima Verossimilhança.

### 3. Visualizações e Gráficos Interativos

- **Gráficos de Confiabilidade:** Visualize e compare as quatro curvas fundamentais da confiabilidade:
  - **Curva de Confiabilidade `R(t)`:** Probabilidade de um item sobreviver até o tempo `t`.
  - **Probabilidade de Falha `F(t)`:** Probabilidade acumulada de um item falhar até o tempo `t`.
  - **Densidade de Probabilidade `f(t)`:** Probabilidade relativa de falha no tempo `t`.
  - **Taxa de Falha (Hazard) `λ(t)`:** Taxa instantânea de falha no tempo `t`.
- **Gráfico de Probabilidade (Probability Plot):** Uma ferramenta visual para verificar a aderência dos dados a uma distribuição escolhida. Os pontos de dados que formam uma linha reta indicam uma boa aderência. O gráfico possui uma escala de eixos 1:1 para uma interpretação visual correta do ângulo da linha (parâmetro Beta).
- **Análise da Curva da Banheira:** Plote os tempos de falha em uma curva da banheira para identificar visualmente as fases de mortalidade infantil, vida útil e desgaste.

### 4. Análise de Parâmetros Weibull (β e η)

- **Interpretação de Beta (β - Parâmetro de Forma):** O aplicativo fornece uma análise clara do parâmetro Beta, ajudando a identificar o modo de falha predominante:
  - **β < 1:** Falhas prematuras (mortalidade infantil).
  - **β ≈ 1:** Falhas aleatórias (vida útil).
  - **β > 1:** Falhas por desgaste.
- **Vida Característica (η - Parâmetro de Escala):** Indica o tempo no qual 63.2% da população de itens terá falhado, um marco crucial para o planejamento da manutenção.

### 5. Análise com Inteligência Artificial

- **Previsor de Risco de Falha:** Utiliza IA para analisar os dados históricos e identificar os principais fatores de risco, classificando-os por ordem de importância.
- **Relatório Abrangente:** Gera uma análise técnica comparativa e detalhada para todos os equipamentos nos quatro gráficos de confiabilidade, explicando o significado das curvas e as diferenças de desempenho.

### 6. Simulador Monte Carlo Avançado

- **Limites de Confiança:** Calcule e visualize os limites de confiança bilaterais ou unilaterais em um gráfico de probabilidade Weibull, usando a Matriz de Fisher. Isso permite quantificar a incerteza de suas previsões de confiabilidade com base em seus dados de falha.
- **Dispersão de Parâmetros:** Execute simulações para visualizar a variabilidade dos parâmetros Beta e Eta. O gráfico mostra como a linha de ajuste pode variar com diferentes amostras, oferecendo uma visão clara sobre a incerteza da estimativa dos parâmetros.
- **Gráfico de Contorno da Razão de Verossimilhança:** Gere um gráfico de contorno para visualizar a região de confiança conjunta dos parâmetros Beta e Eta. A elipse no gráfico mostra a correlação entre os parâmetros e fornece uma imagem completa da incerteza da estimativa, incluindo os limites inferior e superior para cada parâmetro.

## Como Usar

1.  **Adicionar Equipamento:** Na aba "Análise de Confiabilidade", use o painel "Entrada de Dados" para adicionar um novo equipamento.
2.  **Configurar Dados:** Insira o nome, as unidades e os dados de falha. Use as caixas de seleção para especificar se os dados são agrupados ou contêm suspensões.
3.  **Selecionar Análise:** Escolha a distribuição de probabilidade e o método de estimação desejados.
4.  **Analisar Gráficos:** Navegue pelos gráficos interativos para comparar o desempenho e entender o comportamento de falha.
5.  **Usar IA:** Vá para a aba "Análise com IA" para obter insights mais profundos e relatórios automatizados sobre seus dados.
6.  **Consultar Papéis de Probabilidade:** Na aba "Papéis de Probabilidade", explore as tabelas de postos medianos e visualize gráficos dinâmicos para dados inseridos manualmente, uma ótima ferramenta para aprendizado e cálculos manuais.
7.  **Executar Simulações:** Na aba "Simulador Monte Carlo", escolha entre as análises de Limites de Confiança, Dispersão de Parâmetros ou Gráfico de Contorno para aprofundar a análise de incerteza de suas estimativas.