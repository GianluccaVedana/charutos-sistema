# Charutos Premium - Sistema de Gestão

Sistema web completo de gestão para controle de charutos premium.

## Módulos

| Módulo | Descrição |
|--------|-----------|
| Dashboard | KPIs, gráficos de vendas, produtos e clientes |
| Produtos | Cadastro com SKU, custo, preço e margem automática |
| Clientes | Cadastro completo com histórico de compras |
| Estoque | Controle automático com alertas de reposição |
| Consignações | Envio, controle de aberto/fechado e alertas por dias |
| Vendas | Registro com atualização automática de estoque e contas |
| Fluxo de Caixa | Entradas/saídas com saldo acumulado e gráfico |
| Contas a Receber | Títulos com controle de recebimento e alertas de atraso |
| Relatórios | Vendas por período, produto e cliente com gráficos |
| Usuários | Gestão de acesso com 4 perfis (Admin, Financeiro, Vendas, Estoque) |

## Perfis de Acesso

- **Administrador**: Acesso total
- **Financeiro**: Fluxo de caixa, contas a receber, relatórios
- **Vendas**: Clientes, vendas, consignações, estoque
- **Estoque**: Produtos e controle de estoque

## Instalação e Uso

### Primeira vez:
```
instalar.bat
```

### Iniciar o sistema:
```
iniciar.bat
```

### Acessar:
- Sistema: http://localhost:3000
- Login padrão: `admin@charutos.com` / `admin123`

## Tecnologias

- **Frontend**: React 18 + Vite + Tailwind CSS + Recharts
- **Backend**: Node.js + Express
- **Banco de Dados**: SQLite (arquivo local `backend/charutos.db`)
- **Autenticação**: JWT (12h de validade)
