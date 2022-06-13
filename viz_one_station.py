import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

plt.style.use('ggplot')
plt.ion()

df = pd.read_csv('USC00148287.csv', index_col=1)
df.loc[:, ['TMIN', 'TMAX']].plot()

recent = df[df.index > '2019-06-10']

diffs = pd.DataFrame(np.diff(pd.to_datetime(recent.index)).astype('timedelta64[D]').astype(int))
print(diffs.groupby(0).size())
idx = np.argmin(diffs)
print(recent.iloc[idx - 3:idx + 3, :])
