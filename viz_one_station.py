import pandas as pd
import matplotlib.pyplot as plt

plt.style.use('ggplot')
plt.ion()

df = pd.read_csv('USC00048829.csv', index_col=1)
df.loc[:, ['TMIN', 'TMAX']].plot()
