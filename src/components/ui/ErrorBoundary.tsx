import { Component, type ReactNode } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';

type Props = {
  children: ReactNode;
  title?: string;
};

type State = {
  hasError: boolean;
  message: string;
};

/**
 * Impede que um erro de renderização em um dashboard derrube a aplicação
 * inteira (antes, um erro desmontava a árvore React e o app "voltava" para a
 * home). Mostra um cartão de erro com "Tentar novamente" no lugar.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Erro inesperado ao renderizar',
    };
  }

  private reset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          title={this.props.title ?? 'Algo deu errado ao exibir este conteúdo'}
          message={this.state.message}
          onRetry={this.reset}
        />
      );
    }
    return this.props.children;
  }
}
