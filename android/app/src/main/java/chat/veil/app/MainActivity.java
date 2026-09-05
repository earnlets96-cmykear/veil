package chat.veil.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VeilNativeMediaPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
