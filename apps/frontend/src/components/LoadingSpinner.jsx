// Re-export canónico — el spinner vive en atoms/Spinner.jsx
// Uso: <Spinner size="page" /> da el mismo resultado que este componente
import Spinner from './atoms/Spinner';

const LoadingSpinner = () => <Spinner size="page" />;

export default LoadingSpinner;
