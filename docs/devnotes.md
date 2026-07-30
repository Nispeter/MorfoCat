- categorías al guardar proyecto: arreglado a medias. setDataset descartaba las
  categorías que le pasaran (siempre las pisaba con [] o con "group"), eso ya
  no pasa. PERO no está confirmado que fuera la causa de lo que viste: el
  archivo mosca_test quedó con classifierNames [] e idScheme null, y para eso
  algo tuvo que resetear el dataset después de aplicarlas. El único camino que
  encaja es volver al digitalizador y pulsar "Cargar como conjunto de datos"
  otra vez — eso reconstruye los especímenes desde la sesión y las categorías
  se pierden igual. Si fue eso, falta que el traspaso reaplique el idScheme
  sobre los IDs nuevos (las categorías son función pura de idScheme + ID)