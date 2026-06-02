import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

export function useCollection(queryRef) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!queryRef) return undefined;
    return onSnapshot(
      queryRef,
      (snapshot) => {
        setData(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setError(null);
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError);
        setLoading(false);
      },
    );
  }, [queryRef]);

  return { data, loading, error };
}
