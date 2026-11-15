package com.hisabtechnologies.mezgeb;

import android.app.Activity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Emulator-only synthetic data. No production account, no real financial records. */
@RunWith(AndroidJUnit4.class)
public class LedgerUpgradeTest {
    private static final String ORIGIN="https://mezgeb-omega.vercel.app";
    private static final String BUSINESS="CI Upgrade Ledger";
    private static WebView find(View v){
        if(v instanceof WebView)return (WebView)v;
        if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++){WebView found=find(g.getChildAt(i));if(found!=null)return found;}}
        return null;
    }
    private Object js(ActivityScenario<MainActivity> scenario,String code)throws Exception{
        CountDownLatch done=new CountDownLatch(1);
        AtomicReference<String> raw=new AtomicReference<>();
        scenario.onActivity(a->{WebView web=find(a.getWindow().getDecorView());if(web==null){done.countDown();return;}web.evaluateJavascript(code,value->{raw.set(value);done.countDown();});});
        assertTrue("WebView JavaScript callback timed out",done.await(8,TimeUnit.SECONDS));
        assertNotNull("WebView is missing",raw.get());
        return new JSONTokener(raw.get()).nextValue();
    }
    private void waitFor(ActivityScenario<MainActivity> scenario,String code,String expected)throws Exception{
        Object latest=null;
        for(int i=0;i<60;i++){latest=js(scenario,code);if(expected.equals(String.valueOf(latest)))return;Thread.sleep(500);}
        fail("Expected "+expected+" but received "+latest);
    }
    private void ready(ActivityScenario<MainActivity> scenario)throws Exception{
        waitFor(scenario,"document.title","Mezgeb Ready");
        assertEquals(ORIGIN,js(scenario,"location.origin"));
    }
    private void readFixture(ActivityScenario<MainActivity> scenario)throws Exception{
        js(scenario,"(function(){window.__ciResult='pending';var r=indexedDB.open('mezgeb_local_v2');r.onerror=function(){window.__ciResult='open-error'};r.onsuccess=function(){var db=r.result;var tx=db.transaction('documents','readonly');var g=tx.objectStore('documents').get('main');g.onsuccess=function(){var d=g.result&&g.result.value;window.__ciResult=!!(d&&d.business.name==='CI Upgrade Ledger'&&d.entries.length===2&&d.entries[0].cents===12345&&d.entries[1].cents===2345&&d.entries[0].receipt.number==='CI-0001'&&d.customers.length===1&&d.customers[0].events[0].cents===5000&&d.customers[0].events[1].cents===1000&&d.nextDraft===2)?'fixture-ok':'fixture-mismatch'};tx.oncomplete=function(){db.close()}};return true})()");
        waitFor(scenario,"window.__ciResult","fixture-ok");
    }
    @Test public void seedPreviousRelease()throws Exception{
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            ready(scenario);
            js(scenario,"(function(){window.__ciResult='pending';localStorage.setItem('mezgeb_intro_seen','1');localStorage.setItem('mezgeb_signature_tour','1');var now=Date.now(),date=new Date().toISOString().slice(0,10);var r=indexedDB.open('mezgeb_local_v2');r.onerror=function(){window.__ciResult='open-error'};r.onsuccess=function(){var db=r.result;var tx=db.transaction('documents','readwrite');var s=tx.objectStore('documents');var g=s.get('main');g.onsuccess=function(){if(!g.result){tx.abort();return;}var d=g.result.value;d.business={name:'CI Upgrade Ledger',tin:'',phone:'',vatRegistered:false};d.entries=[{id:'ci-sale',type:'sale',cents:12345,category:'Product sale',pay:'Cash',note:'CI sale marker',createdAt:now,date:date,receipt:{number:'CI-0001',status:'draft'}},{id:'ci-expense',type:'expense',cents:2345,category:'Stock purchase',pay:'Cash',note:'CI expense marker',createdAt:now-1,date:date,receipt:null}];d.customers=[{id:'ci-customer',name:'CI Customer',phone:'',events:[{id:'ci-credit',type:'credit',cents:5000,note:'CI credit',createdAt:now},{id:'ci-payment',type:'payment',cents:1000,note:'CI repayment',createdAt:now}]}];d.nextDraft=2;d.updatedAt=now;s.put({key:'main',value:d});};tx.oncomplete=function(){db.close();window.__ciResult='seeded'};tx.onabort=function(){db.close();window.__ciResult='seed-error'}};return true})()");
            waitFor(scenario,"window.__ciResult","seeded");
            readFixture(scenario);
        }
    }
    @Test public void verifyPreviousOrUpgradedLedger()throws Exception{
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            ready(scenario);readFixture(scenario);
            waitFor(scenario,"String(document.body.innerText.includes('CI Upgrade Ledger')&&document.body.innerText.includes('CI sale marker'))","true");
            // Same origin, normal app routing, no test-only production JavaScript bridge.
            js(scenario,"(function(){location.assign(location.pathname.replace(/\\/$/,'')+'/dube');return true})()");
            ready(scenario);
            waitFor(scenario,"String(document.body.innerText.includes('CI Customer'))","true");
            readFixture(scenario);
        }
    }
    @Test public void verifyOfflineUpgrade()throws Exception{
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            ready(scenario);
            waitFor(scenario,"String(navigator.onLine)","false");
            readFixture(scenario);
            waitFor(scenario,"String(document.body.innerText.includes('CI Upgrade Ledger'))","true");
            assertTrue("Expected 1.0.4 bundled route",String.valueOf(js(scenario,"location.pathname")).startsWith("/__mezgeb_native__/1.0.4/"));
        }
    }
}
