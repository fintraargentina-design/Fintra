export interface ConclusionColors {
  textColor: string;
  bgColor: string;
  borderColor: string;
}

export const getConclusionColors = (conclusion: string): ConclusionColors => {
  if (!conclusion) {
    return { 
      textColor: 'text-gray-400', 
      bgColor: 'bg-gray-900/50',
      borderColor: 'border-green-400/20'
    };
  }
  
  const lowerConclusion = conclusion.toLowerCase();
  
  // Verde - Buena acción
  if (lowerConclusion.includes('buena acción') || 
      lowerConclusion.includes('recomendable') ||
      lowerConclusion.includes('comprar') ||
      lowerConclusion.includes('positivo') ||
      lowerConclusion.includes('🟢')) {
    return { 
      textColor: 'text-green-400', 
      bgColor: 'bg-green-100',
      borderColor: 'border-green-400/20'
    };
  }
  
  // Amarillo - Investigar más
  if (lowerConclusion.includes('investigá más') ||
      lowerConclusion.includes('podría ser') ||
      lowerConclusion.includes('neutral') ||
      lowerConclusion.includes('precaución') ||
      lowerConclusion.includes('🟡')) {
    return { 
      textColor: 'text-yellow-400', 
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-400/20'
    };
  }
  
  // Rojo - No es buena
  if (lowerConclusion.includes('no es buena') ||
      lowerConclusion.includes('no recomendable') ||
      lowerConclusion.includes('vender') ||
      lowerConclusion.includes('negativo') ||
      lowerConclusion.includes('🔴')) {
    return { 
      textColor: 'text-red-400', 
      bgColor: 'bg-red-100',
      borderColor: 'border-red-400/20'
    };
  }
  
  // Por defecto (tema oscuro)
  return { 
    textColor: 'text-gray-400', 
    bgColor: 'bg-gray-900/50',
    borderColor: 'border-green-400/20'
  };
};